/**
 * @file: plugin.ts
 * @description: 插件系统类型 — PluginContext / PluginManifest / PluginInstance
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [plugin],[types]
 * @migrated: 从 archive/ide-monolith-2026-03/types/index.ts 抽取插件类型段（第二批 · 2026-08-20）
 *
 * details: 淘汰滞后的 PluginContext（其 API 面落后于插件实际用法，原靠 @ts-nocheck 掩盖），
 *          插件 activate 参数统一改用 services/plugins/PluginSystem 的 PluginAPI
 */

// ── 插件系统类型 ──

export interface PluginManifest {
  id: string;
  name: string;
  nameEn?: string;
  version: string;
  description: string;
  descriptionEn?: string;
  author: string;
  homepage?: string;
  license?: string;
  main?: string;
  entry?: string;
  icon?: string;
  category?: string;
  permissions?: string[];
  dependencies?: Record<string, string>;
  activationEvents?: string[];
  tags?: string[];
  activate?: (context: import("../services/plugins/PluginSystem").PluginAPI) => void;
  deactivate?: () => void;
}

export type PluginStatus = "installed" | "active" | "disabled" | "error";

export interface PluginInstance {
  manifest: PluginManifest;
  status: PluginStatus;
  exports?: Record<string, unknown>;
  error?: string;
}
