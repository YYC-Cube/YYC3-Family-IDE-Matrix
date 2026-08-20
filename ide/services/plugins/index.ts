/**
 * @file: index.ts
 * @description: 插件系统统一出口 — PluginSystem + 内置插件
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [plugins],[index],[barrel]
 */

export * from "./PluginSystem";
export type { PluginManifest, PluginInstance, PluginStatus } from "../../types/plugin";
