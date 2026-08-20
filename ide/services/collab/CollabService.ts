/**
 * @file: CollabService.ts
 * @description: Yjs 实时协作服务（v2 胶水版）— CRDT 文档同步 + 在线感知 + 光标 +
 *              离线持久化 + Monaco 绑定，传输/持久化/绑定全部复用官方生态
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: collaboration,yjs,crdt,realtime,sync,awareness,monaco
 *
 * brief: 第三批决策一实施 —— 归档版 CollabService(741行) 的 Yjs 胶水化重写
 *
 * details（替换映射，见 archive/MIGRATION.md 批③决策一）:
 * - 自研 sync-step-1/2 WS 协议      → y-websocket WebsocketProvider
 * - 自研离线队列                     → y-indexeddb IndexeddbPersistence
 * - 光标/在线状态                    → provider.awareness（Y.Awareness）
 * - Monaco 编辑器同步                → y-monaco MonacoBinding
 * - ThreeWayMerge 冲突解决           → 删除（CRDT 收敛即无三方合并场景）
 * - 结果：741 行 → 约 250 行胶水（含注释与类型）
 *
 * usage:
 * ```ts
 * const collab = createCollabService({
 *   serverUrl: "wss://collab.example.com",
 *   room: "proj-42",
 *   userName: "YYC³",
 *   userColor: "#06b6d4",
 * });
 * collab.connect();
 * collab.setFileContent("src/App.tsx", "...");   // Y.Map<Y.Text>
 * const unbind = collab.bindEditor(monacoEditor, "src/App.tsx");
 * ```
 */

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { MonacoBinding } from "y-monaco";
import { logger } from "../logger";
import type {
  CollabEvent,
  CollabServiceOptions,
  CollabUser,
  ConnectionStatus,
  CursorPosition,
} from "./types";

/** 文件内容在 Y.Doc 中的容器名：Y.Map<string, Y.Text> */
const FILES_MAP = "files";

/** Monaco 编辑器的最小结构类型（避免服务层硬引 monaco-editor 类型） */
interface MonacoEditorLike {
  getModel?: () => unknown;
  onDidChangeCursorPosition?: (cb: (e: unknown) => void) => void;
}

export class CollabService {
  readonly doc: Y.Doc;
  private provider: WebsocketProvider | null = null;
  private persistence: IndexeddbPersistence | null = null;
  private undoManager: Y.UndoManager;
  private listeners = new Set<(event: CollabEvent) => void>();
  private bindings = new Map<string, MonacoBinding>();
  private status: ConnectionStatus = "disconnected";
  private readonly options: CollabServiceOptions;

  constructor(options: CollabServiceOptions) {
    this.options = options;
    this.doc = new Y.Doc();
    this.undoManager = new Y.UndoManager(this.getFilesMap(), {
      trackedOrigins: new Set([this]), // 只追踪本服务发起的本地编辑
      captureTimeout: 0, // 每次文件写入是独立撤销步（默认 500ms 会合并连续写入）
    });
  }

  // ── 生命周期 ──

  connect(): void {
    if (this.provider) return;

    this.setStatus("connecting");

    // 1) 传输层：y-websocket（自研 sync-step 协议的官方替代）
    this.provider = new WebsocketProvider(
      this.options.serverUrl,
      this.options.room,
      this.doc,
      { connect: true },
    );
    this.provider.on("status", ({ status }: { status: ConnectionStatus }) => {
      this.setStatus(status === "connected" ? "connected" : "disconnected");
    });

    // 2) 在线感知：声明本地用户（Y.Awareness）
    this.provider.awareness.setLocalStateField("user", {
      id: this.doc.clientID.toString(36),
      name: this.options.userName,
      color: this.options.userColor,
      lastSeen: Date.now(),
    });
    this.provider.awareness.on("update", () => {
      this.emit({ type: "users-changed", payload: this.getUsers() });
    });

    // 3) 离线持久化：y-indexeddb（自研离线队列的官方替代）
    if (this.options.persistence !== false) {
      this.persistence = new IndexeddbPersistence(
        `yyc3-collab-${this.options.room}`,
        this.doc,
      );
      this.persistence.on("synced", () => {
        logger.warn(`[Collab] offline cache loaded for room ${this.options.room}`);
      });
    }
  }

  disconnect(): void {
    for (const key of this.bindings.keys()) this.unbindEditor(key);
    this.provider?.destroy();
    this.provider = null;
    void this.persistence?.destroy();
    this.persistence = null;
    this.setStatus("disconnected");
  }

  // ── 共享文档访问（与归档版 API 兼容）──

  getText(name = "main"): Y.Text {
    return this.doc.getText(name);
  }

  getMap(name = "meta"): Y.Map<unknown> {
    return this.doc.getMap(name);
  }

  getArray(name = "items"): Y.Array<unknown> {
    return this.doc.getArray(name);
  }

  getDoc(): Y.Doc {
    return this.doc;
  }

  // ── 文件级读写（Y.Map<string, Y.Text>）──

  private getFilesMap(): Y.Map<Y.Text> {
    return this.doc.getMap(FILES_MAP);
  }

  setFileContent(filePath: string, content: string): void {
    this.doc.transact(() => {
      const files = this.getFilesMap();
      let text = files.get(filePath);
      if (!text) {
        text = new Y.Text();
        files.set(filePath, text);
      }
      text.delete(0, text.length);
      text.insert(0, content);
    }, this);
  }

  getFileContent(filePath: string): string | null {
    return this.getFilesMap().get(filePath)?.toString() ?? null;
  }

  observeFile(filePath: string, cb: () => void): () => void {
    const text = this.getFilesMap().get(filePath);
    if (!text) return () => undefined;
    const handler = () => cb();
    text.observe(handler);
    return () => text.unobserve(handler);
  }

  // ── Monaco 绑定（y-monaco）──

  /**
   * 将 Monaco 编辑器绑定到共享文件。
   * @returns 解绑函数
   */
  bindEditor(editor: MonacoEditorLike, filePath: string): () => void {
    if (this.bindings.has(filePath)) this.unbindEditor(filePath);

    const model = editor.getModel?.();
    if (!model) {
      logger.error(`[Collab] bindEditor: editor has no model for ${filePath}`);
      return () => undefined;
    }

    const files = this.getFilesMap();
    let text = files.get(filePath);
    if (!text) {
      text = new Y.Text();
      files.set(filePath, text);
    }

    // y-monaco 0.1.6 签名：(ytext, monacoModel, editors: Set, awareness?)
    // 文本双向同步 + awareness 光标/选区
    const binding = new MonacoBinding(
      text,
      model as never,
      new Set([editor as never]),
      this.provider?.awareness ?? null,
    );
    this.bindings.set(filePath, binding);

    return () => this.unbindEditor(filePath);
  }

  unbindEditor(filePath: string): void {
    this.bindings.get(filePath)?.destroy?.();
    this.bindings.delete(filePath);
  }

  // ── 撤销/重做 ──

  undo(): void {
    this.undoManager.undo();
  }

  redo(): void {
    this.undoManager.redo();
  }

  canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }

  // ── 在线用户与光标（Y.Awareness）──

  getUsers(): CollabUser[] {
    if (!this.provider) return [];
    const users: CollabUser[] = [];
    for (const state of this.provider.awareness.getStates().values()) {
      const user = (state as Record<string, unknown>).user as
        | CollabUser
        | undefined;
      if (user) users.push(user);
    }
    return users;
  }

  updateCursor(cursor: CursorPosition): void {
    this.provider?.awareness.setLocalStateField("cursor", cursor);
    this.emit({ type: "cursor-updated", payload: cursor });
  }

  getCursorMap(): Map<string, CursorPosition> {
    const cursors = new Map<string, CursorPosition>();
    if (!this.provider) return cursors;
    for (const [clientID, state] of this.provider.awareness.getStates()) {
      const cursor = (state as Record<string, unknown>).cursor as
        | CursorPosition
        | undefined;
      if (cursor) cursors.set(clientID.toString(36), cursor);
    }
    return cursors;
  }

  // ── 状态与事件 ──

  getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  subscribe(listener: (event: CollabEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.emit({ type: "status-changed", payload: status });
  }

  private emit(event: Omit<CollabEvent, "timestamp">): void {
    for (const listener of this.listeners) {
      try {
        listener({ ...event, timestamp: Date.now() });
      } catch (error) {
        logger.error("[Collab] listener error:", error);
      }
    }
  }

  destroy(): void {
    this.disconnect();
    this.undoManager.destroy();
    this.doc.destroy();
    this.listeners.clear();
  }
}

/** 工厂：创建独立实例（多房间场景各自持有） */
export function createCollabService(options: CollabServiceOptions): CollabService {
  return new CollabService(options);
}
