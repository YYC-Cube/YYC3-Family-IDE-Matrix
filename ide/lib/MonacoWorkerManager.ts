/**
 * @file: MonacoWorkerManager.ts
 * @description: Monaco Editor Worker 按需加载管理器
 *              仅在需要时加载对应的语言Worker，减少首屏加载资源
 *              支持优先级预加载、Worker 池复用、自动清理
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-03-30
 * @updated: 2026-04-17
 * @status: production
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: monaco,worker,lazy-load,optimization
 */

import { logger } from "./logger";

type WorkerLabel = 'json' | 'css' | 'scss' | 'less' | 'html' | 'handlebars' | 'razor' | 'typescript' | 'javascript' | 'default';

const workerCache = new Map<string, Worker>();
const loadedWorkers = new Set<string>();
const loadingPromises = new Map<string, Promise<Worker>>();

// Vite 8（rolldown）下 new URL('pkg/worker.js', import.meta.url) 的裸包
// 说明符无法在 worker 打包阶段解析（报 lib/monaco-editor/... UNRESOLVED_ENTRY）。
// 且 monaco-editor 0.56 的 exports 通配（./* -> esm/vs/*.js）不跨目录，
// Node resolve 深层 worker 路径全部被挡。
// 方案：vite.config.ts 增加 monaco-worker:* alias 指向磁盘真实文件，
// 配合 ?worker&url 出独立 worker chunk（仅构建期解析，运行时为 URL）。
import cssWorkerUrl from 'monaco-worker:css';
import editorWorkerUrl from 'monaco-worker:editor';
import htmlWorkerUrl from 'monaco-worker:html';
import jsonWorkerUrl from 'monaco-worker:json';
import tsWorkerUrl from 'monaco-worker:ts';

const workerLoaders: Partial<Record<WorkerLabel, () => Promise<Worker>>> = {
  json: async () => {
    const worker = new Worker(jsonWorkerUrl, { type: 'module' });
    workerCache.set('json', worker);
    loadedWorkers.add('json');
    return worker;
  },

  css: async () => {
    const worker = new Worker(cssWorkerUrl, { type: 'module' });
    workerCache.set('css', worker);
    workerCache.set('scss', worker);
    workerCache.set('less', worker);
    loadedWorkers.add('css');
    loadedWorkers.add('scss');
    loadedWorkers.add('less');
    return worker;
  },

  html: async () => {
    const worker = new Worker(htmlWorkerUrl, { type: 'module' });
    workerCache.set('html', worker);
    workerCache.set('handlebars', worker);
    workerCache.set('razor', worker);
    loadedWorkers.add('html');
    loadedWorkers.add('handlebars');
    loadedWorkers.add('razor');
    return worker;
  },

  typescript: async () => {
    const worker = new Worker(tsWorkerUrl, { type: 'module' });
    workerCache.set('typescript', worker);
    workerCache.set('javascript', worker);
    loadedWorkers.add('typescript');
    loadedWorkers.add('javascript');
    return worker;
  },
};

let defaultWorker: Worker | null = null;

const getDefaultWorker = (): Worker => {
  if (!defaultWorker) {
    defaultWorker = new Worker(editorWorkerUrl, { type: 'module' });
  }
  return defaultWorker;
};

export async function getWorker(label: string): Promise<Worker> {
  if (workerCache.has(label)) {
    return workerCache.get(label)!;
  }

  const workerLabel = mapToWorkerLabel(label);

  if (loadedWorkers.has(label)) {
    return workerCache.get(label) || getDefaultWorker();
  }

  const existingPromise = loadingPromises.get(workerLabel);
  if (existingPromise) {
    return existingPromise;
  }

  const loader = workerLoaders[workerLabel];
  if (loader) {
    const promise = loader().then((worker) => {
      loadingPromises.delete(workerLabel);
      logger.warn(`Loaded worker for: ${label}`);
      return worker;
    }).catch((err) => {
      loadingPromises.delete(workerLabel);
      logger.error(`[MonacoWorker] Failed to load worker for ${label}:`, err);
      return getDefaultWorker();
    });

    loadingPromises.set(workerLabel, promise);
    return promise;
  }

  logger.warn(`Using default worker for: ${label}`);
  return getDefaultWorker();
}

function mapToWorkerLabel(label: string): WorkerLabel {
  const labelMap: Record<string, WorkerLabel> = {
    'json': 'json',
    'css': 'css',
    'scss': 'css',
    'less': 'css',
    'html': 'html',
    'handlebars': 'html',
    'razor': 'html',
    'typescript': 'typescript',
    'javascript': 'typescript',
    'jsx': 'typescript',
    'tsx': 'typescript',
  };

  return labelMap[label] || 'default';
}

export async function preloadCommonWorkers(): Promise<void> {
  const editorWorkerPromise = Promise.resolve(getDefaultWorker());
  const tsWorkerPromise = getWorker('typescript');

  await Promise.allSettled([editorWorkerPromise, tsWorkerPromise]);
  logger.warn('Preloaded core workers (editor + typescript)');
}

export function scheduleWorkerPreload(labels: WorkerLabel[], delayMs: number = 3000): void {
  const preload = () => {
    const promises = labels.map((label) => getWorker(label));
    Promise.allSettled(promises).then(() => {
      logger.warn(`Scheduled preload completed for: ${labels.join(", ")}`);
    });
  };

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(() => setTimeout(preload, delayMs), {
      timeout: delayMs + 5000,
    });
  } else {
    setTimeout(preload, delayMs);
  }
}

export function getWorkerStats() {
  return {
    loaded: Array.from(loadedWorkers),
    cached: Array.from(workerCache.keys()),
    loading: Array.from(loadingPromises.keys()),
    totalLoaded: loadedWorkers.size,
    totalCached: workerCache.size,
  };
}

export function cleanupWorkers(): void {
  workerCache.forEach((worker) => worker.terminate());
  workerCache.clear();
  loadedWorkers.clear();
  loadingPromises.clear();
  if (defaultWorker) {
    defaultWorker.terminate();
    defaultWorker = null;
  }
  logger.warn('All workers cleaned up');
}

export function configureMonacoEnvironment(): void {
  if (typeof window !== 'undefined') {
    (window as any).MonacoEnvironment = {
      getWorker: async function (_workerId: string, label: string) {
        return await getWorker(label);
      },
    };
    logger.warn('Environment configured for lazy loading');
  }
}
