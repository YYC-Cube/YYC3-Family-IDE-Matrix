/**
 * @file: config.ts
 * @description: 协作服务配置 — 服务端地址/房间/身份经 env 或显式覆盖注入（增强③）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [collab],[config],[env]
 *
 * brief: 协作服务端地址配置化 —— 默认本地开发地址，部署时经 Vite env 覆盖
 *
 * env 约定：
 *   VITE_COLLAB_SERVER_URL  y-websocket 服务地址（如 wss://collab.example.com）
 *   VITE_COLLAB_ROOM        默认房间名
 *   VITE_COLLAB_USER_NAME   默认显示名
 */

import { createCollabService, type CollabService } from "./CollabService";
import type { CollabServiceOptions } from "./types";

/** 协作服务完整配置 */
export interface CollabServerConfig {
  serverUrl: string;
  room: string;
  userName: string;
  userColor: string;
  persistence: boolean;
}

/** 本地开发默认值（生产部署必须覆盖 serverUrl） */
export const COLLAB_DEFAULTS: CollabServerConfig = {
  serverUrl: "ws://localhost:1234",
  room: "yyc3-default",
  userName: "本机开发者",
  userColor: "#06b6d4",
  persistence: true,
};

/** 从 Vite env 读取覆盖（仅接受已定义的字符串值） */
export function resolveCollabConfigFromEnv(
  env: Record<string, string | undefined> = {},
): CollabServerConfig {
  const merged: CollabServerConfig = { ...COLLAB_DEFAULTS };
  if (env.VITE_COLLAB_SERVER_URL) merged.serverUrl = env.VITE_COLLAB_SERVER_URL;
  if (env.VITE_COLLAB_ROOM) merged.room = env.VITE_COLLAB_ROOM;
  if (env.VITE_COLLAB_USER_NAME) merged.userName = env.VITE_COLLAB_USER_NAME;
  return merged;
}

/**
 * 按配置创建协作服务（配置化工厂，增强③入口）。
 * @param overrides 显式覆盖（优先于 env 与默认值）
 */
export function createCollabServiceFromConfig(
  overrides: Partial<CollabServiceOptions> = {},
  env: Record<string, string | undefined> = (
    (import.meta as unknown as { env?: Record<string, string> }).env ?? {}
  ),
): CollabService {
  const config = resolveCollabConfigFromEnv(env);
  return createCollabService({
    serverUrl: config.serverUrl,
    room: config.room,
    userName: config.userName,
    userColor: config.userColor,
    persistence: config.persistence,
    ...overrides,
  });
}

/** 当前生效配置的读取器（面板展示/诊断用） */
export function getCollabDefaults(): Readonly<CollabServerConfig> {
  return COLLAB_DEFAULTS;
}
