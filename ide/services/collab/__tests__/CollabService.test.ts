/**
 * @file: CollabService.test.ts
 * @description: Yjs 胶水版协作服务单测 — 生命周期/文件读写/撤销/用户光标/Monaco 绑定
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[collab],[yjs]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";

// y-websocket 需要真实 WS 服务，测试用 FakeProvider 替代（Awareness 语义以轻量假实现模拟）
vi.mock("y-websocket", () => {
  class FakeAwareness {
    doc: Y.Doc;
    private states = new Map<number, Record<string, unknown>>();
    private listeners = new Set<() => void>();
    constructor(doc: Y.Doc) {
      this.doc = doc;
    }
    setLocalStateField(field: string, value: unknown): void {
      this.states.set(this.doc.clientID, {
        ...(this.states.get(this.doc.clientID) ?? {}),
        [field]: value,
      });
      this.listeners.forEach((l) => l());
    }
    getStates(): Map<number, Record<string, unknown>> {
      return this.states;
    }
    on(_event: string, cb: () => void): void {
      this.listeners.add(cb);
    }
  }
  class FakeWebsocketProvider {
    static instances: FakeWebsocketProvider[] = [];
    doc: Y.Doc;
    room: string;
    awareness: FakeAwareness;
    private listeners = new Map<string, Array<(e: unknown) => void>>();
    destroyed = false;
    constructor(_url: string, room: string, doc: Y.Doc) {
      this.doc = doc; // 先赋 doc，再建 awareness（字段初始化顺序）
      this.room = room;
      this.awareness = new FakeAwareness(doc);
      FakeWebsocketProvider.instances.push(this);
    }
    on(event: string, cb: (e: unknown) => void): void {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), cb]);
    }
    emitStatus(status: string): void {
      (this.listeners.get("status") ?? []).forEach((cb) => cb({ status }));
    }
    destroy(): void {
      this.destroyed = true;
    }
  }
  return { WebsocketProvider: FakeWebsocketProvider };
});

// jsdom 无 indexedDB，persistence 走 mock 验证接线而非真实落盘
vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Monaco 绑定验证接线参数，不引真实 monaco
vi.mock("y-monaco", () => ({
  MonacoBinding: vi.fn().mockImplementation(function (this: unknown, ...args: unknown[]) {
    return { args, destroy: vi.fn() };
  }),
}));

import { CollabService, createCollabService } from "../CollabService";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";

/** FakeProvider 实例的结构化视图 */
interface FakeProviderInstance {
  room: string;
  destroyed: boolean;
  awareness: {
    setLocalStateField: (f: string, v: unknown) => void;
    getStates: () => Map<number, Record<string, unknown>>;
  };
  emitStatus: (s: string) => void;
}

function lastProvider(): FakeProviderInstance {
  const instances = (
    WebsocketProvider as unknown as { instances: FakeProviderInstance[] }
  ).instances;
  return instances[instances.length - 1];
}

function resetProviders(): void {
  (WebsocketProvider as unknown as { instances: FakeProviderInstance[] }).instances = [];
}

function makeService() {
  return createCollabService({
    serverUrl: "ws://localhost:1234",
    room: "test-room",
    userName: "测试者",
    userColor: "#06b6d4",
    persistence: false,
  });
}

beforeEach(() => {
  resetProviders();
  vi.mocked(MonacoBinding).mockClear();
});

describe("CollabService（Yjs 胶水版）", () => {
  it("connect 创建 y-websocket provider 并声明本地用户", () => {
    const service = makeService();
    service.connect();

    const provider = lastProvider();
    expect(provider.room).toBe("test-room");
    expect(service.getConnectionStatus()).toBe("connecting");

    const states = provider.awareness.getStates();
    const local = [...states.values()][0];
    expect(local.user).toMatchObject({ name: "测试者", color: "#06b6d4" });
    service.destroy();
  });

  it("provider status 事件映射为服务状态并广播", () => {
    const service = makeService();
    const events: string[] = [];
    service.subscribe((e) => {
      if (e.type === "status-changed") events.push(e.payload as string);
    });
    service.connect();

    const provider = lastProvider();
    provider.emitStatus("connected");
    expect(service.getConnectionStatus()).toBe("connected");
    expect(events).toEqual(["connecting", "connected"]);

    service.destroy();
    expect(service.getConnectionStatus()).toBe("disconnected");
    expect(provider.destroyed).toBe(true);
  });

  it("persistence=true 时接线 y-indexeddb", async () => {
    const { IndexeddbPersistence } = await import("y-indexeddb");
    const service = createCollabService({
      serverUrl: "ws://localhost:1234",
      room: "persist-room",
      userName: "p",
      userColor: "#fff",
      persistence: true,
    });
    service.connect();
    expect(IndexeddbPersistence).toHaveBeenCalledWith(
      "yyc3-collab-persist-room",
      service.getDoc(),
    );
    service.destroy();
  });

  it("两个实例经 Y.Doc 更新实现文档收敛（CRDT 核心语义）", () => {
    const a = makeService();
    a.connect();
    a.setFileContent("App.tsx", "const A = 1;");

    // provider 为假实现，用 Y.Update 桥接验证数据面收敛
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a.getDoc()));
    expect(b.getMap("files").get("App.tsx")?.toString()).toBe("const A = 1;");
    a.destroy();
  });

  it("setFileContent 支持 observeFile 订阅与撤销/重做", () => {
    const service = makeService();
    service.setFileContent("a.ts", "v1");
    const seen: string[] = [];
    const unsub = service.observeFile("a.ts", () =>
      seen.push(service.getFileContent("a.ts") ?? ""),
    );

    service.setFileContent("a.ts", "v2");
    expect(seen).toEqual(["v2"]);

    expect(service.canUndo()).toBe(true);
    service.undo();
    expect(service.getFileContent("a.ts")).toBe("v1");
    expect(service.canRedo()).toBe(true);
    service.redo();
    expect(service.getFileContent("a.ts")).toBe("v2");

    unsub();
    service.destroy();
  });

  it("updateCursor 写入 awareness，getCursorMap/getUsers 可读回", () => {
    const service = makeService();
    service.connect();
    service.updateCursor({ file: "a.ts", line: 3, column: 7 });

    const cursors = service.getCursorMap();
    expect(cursors.size).toBe(1);
    expect([...cursors.values()][0]).toMatchObject({ file: "a.ts", line: 3 });

    expect(service.getUsers()).toHaveLength(1);
    expect(service.getUsers()[0].name).toBe("测试者");
    service.destroy();
  });

  it("bindEditor 以共享 Y.Text + awareness 接线 MonacoBinding，可解绑", () => {
    const service = makeService();
    service.connect();
    service.setFileContent("m.ts", "hello");

    const fakeModel = { id: 1 };
    const fakeEditor = { getModel: () => fakeModel };
    const unbind = service.bindEditor(fakeEditor, "m.ts");

    expect(MonacoBinding).toHaveBeenCalledTimes(1);
    const args = vi.mocked(MonacoBinding).mock.calls[0];
    // y-monaco 0.1.6 签名：(ytext, monacoModel, editors: Set, awareness?)
    expect((args[0] as Y.Text).toString()).toBe("hello");
    expect(args[1]).toBe(fakeModel);
    expect(args[2]).toBeInstanceOf(Set);
    expect(args[3]).toBeDefined(); // provider.awareness（FakeAwareness 实例）

    unbind();
    // 再次绑定不报错（旧绑定先解绑）
    expect(() => service.bindEditor(fakeEditor, "m.ts")).not.toThrow();
    service.destroy();
  });

  it("无 model 的编辑器 bindEditor 安全返回空解绑", () => {
    const service = makeService();
    const unbind = service.bindEditor({ getModel: () => null }, "x.ts");
    expect(MonacoBinding).not.toHaveBeenCalled();
    expect(() => unbind()).not.toThrow();
    service.destroy();
  });
});
