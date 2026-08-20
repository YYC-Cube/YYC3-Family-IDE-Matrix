/**
 * @file: index.ts
 * @description: 协作服务统一出口 — Yjs 胶水版 CollabService
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [collab],[index],[barrel]
 */

export { CollabService, createCollabService } from "./CollabService";
export type {
  CollabServiceOptions,
  CollabEvent,
  CollabUser,
  ConnectionStatus,
  CursorPosition,
} from "./types";
