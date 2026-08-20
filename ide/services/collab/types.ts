/**
 * @file: types.ts
 * @description: 协作服务共享类型 — 连接状态 / 用户 / 光标 / 事件
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [collab],[types],[yjs]
 */

/** 连接状态（对齐 y-websocket provider status 事件） */
export type ConnectionStatus = "connected" | "connecting" | "disconnected";

/** 协作用户（Awareness local state 的 user 字段） */
export interface CollabUser {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
}

/** 光标/选区位置 */
export interface CursorPosition {
  file: string;
  line: number;
  column: number;
  length?: number;
}

/** 协作事件（供面板订阅） */
export interface CollabEvent {
  type:
    | "status-changed"
    | "users-changed"
    | "cursor-updated"
    | "file-updated"
    | "sync-updated";
  payload?: unknown;
  timestamp: number;
}

/** 服务构造选项 */
export interface CollabServiceOptions {
  /** y-websocket 服务地址，如 wss://collab.example.com */
  serverUrl: string;
  /** 房间名（同一房间共享文档） */
  room: string;
  userName: string;
  userColor: string;
  /** 是否启用 y-indexeddb 离线持久化（默认 true；测试环境传 false） */
  persistence?: boolean;
}
