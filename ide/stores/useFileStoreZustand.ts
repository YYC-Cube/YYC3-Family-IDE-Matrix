/**
 * @file: stores/useFileStoreZustand.ts
 * @description: 文件状态管理 Store (Zustand 实现)
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [store],[file],[zustand]
 *
 * brief: 文件系统状态管理
 *
 * details:
 * - 管理文件内容、打开的文件、项目结构
 * - 提供 CRUD 操作和快照能力
 *
 * dependencies: zustand
 * exports: useFileStoreZustand
 * notes: 存根实现，实际项目需安装 zustand
 */

// ================================================================
// 类型定义
// ================================================================

export interface FileStoreState {
  /** 文件内容映射: path -> content */
  fileContents: Record<string, string>;
  /** 当前打开的文件路径 */
  currentFilePath: string | null;
  /** 项目根路径 */
  projectRoot: string;
  /** 最近打开的文件列表 */
  recentFiles: string[];
}

export interface FileStoreActions {
  /** 初始化项目文件 */
  initializeProject: (files: Record<string, string>, firstFile?: string) => void;
  /** 更新文件内容 */
  updateFile: (path: string, content: string) => void;
  /** 打开文件 */
  openFile: (path: string) => void;
  /** 关闭文件 */
  closeFile: (path: string) => void;
  /** 删除文件 */
  deleteFile: (path: string) => void;
  /** 重命名文件 */
  renameFile: (oldPath: string, newPath: string) => void;
  /** 获取文件内容 */
  getFileContent: (path: string) => string | undefined;
  /** 文件是否存在 */
  fileExists: (path: string) => boolean;
}

export type FileStore = FileStoreState & FileStoreActions;

// ================================================================
// 内存态实现（不依赖 zustand，避免无依赖环境下报错）
// ================================================================

let state: FileStoreState = {
  fileContents: {},
  currentFilePath: null,
  projectRoot: "/workspace",
  recentFiles: [],
};

const listeners: Set<() => void> = new Set();

function setState(partial: Partial<FileStoreState>): void {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

function getState(): FileStoreState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const actions: FileStoreActions = {
  initializeProject(files, firstFile) {
    setState({
      fileContents: { ...files },
      currentFilePath: firstFile || null,
      recentFiles: firstFile ? [firstFile] : [],
    });
  },

  updateFile(path, content) {
    setState({
      fileContents: {
        ...state.fileContents,
        [path]: content,
      },
    });
  },

  openFile(path) {
    const recent = [path, ...state.recentFiles.filter((f) => f !== path)].slice(0, 10);
    setState({
      currentFilePath: path,
      recentFiles: recent,
    });
  },

  closeFile(path) {
    const recent = state.recentFiles.filter((f) => f !== path);
    const newCurrent =
      state.currentFilePath === path ? recent[0] || null : state.currentFilePath;
    setState({
      currentFilePath: newCurrent,
      recentFiles: recent,
    });
  },

  deleteFile(path) {
    const nextContents = { ...state.fileContents };
    delete nextContents[path];
    const recent = state.recentFiles.filter((f) => f !== path);
    const newCurrent =
      state.currentFilePath === path ? recent[0] || null : state.currentFilePath;
    setState({
      fileContents: nextContents,
      currentFilePath: newCurrent,
      recentFiles: recent,
    });
  },

  renameFile(oldPath, newPath) {
    if (!state.fileContents[oldPath]) return;
    const nextContents = { ...state.fileContents };
    nextContents[newPath] = nextContents[oldPath];
    delete nextContents[oldPath];
    const recent = state.recentFiles.map((f) => (f === oldPath ? newPath : f));
    const newCurrent =
      state.currentFilePath === oldPath ? newPath : state.currentFilePath;
    setState({
      fileContents: nextContents,
      currentFilePath: newCurrent,
      recentFiles: recent,
    });
  },

  getFileContent(path) {
    return state.fileContents[path];
  },

  fileExists(path) {
    return path in state.fileContents;
  },
};

// ================================================================
// 兼容 zustand API 的 Store 对象
// ================================================================

function useFileStoreZustand<T = FileStore>(selector?: (state: FileStore) => T): T {
  if (selector) {
    return selector({ ...state, ...actions });
  }
  return { ...state, ...actions } as T;
}

useFileStoreZustand.getState = (): FileStore => ({ ...state, ...actions });
useFileStoreZustand.setState = setState;
useFileStoreZustand.subscribe = subscribe;

export { useFileStoreZustand };
export default useFileStoreZustand;
