/**
 * @file: PluginSystem.test.ts
 * @description: 插件系统从 0 到 1 测试 — 注册/激活(真实调用入口)/命令/事件/沙箱面/生命周期
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[plugins],[system]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pluginManager } from "../PluginSystem";
import type { PluginManifest } from "../../../types/plugin";

const cleanupIds: string[] = [];

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: `test-plugin-${Math.random().toString(36).slice(2, 7)}`,
    name: "测试插件",
    version: "1.0.0",
    description: "用于单元测试的插件",
    author: "YYC³",
    ...overrides,
  };
}

function register(manifest: PluginManifest): PluginManifest {
  pluginManager.register(manifest);
  cleanupIds.push(manifest.id);
  return manifest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  for (const id of cleanupIds.splice(0)) {
    pluginManager.unregister(id);
  }
});

describe("PluginManager 核心生命周期", () => {
  it("register 登记清单且拒绝重复注册", () => {
    const m = register(makeManifest());
    expect(pluginManager.register(m)).toBe(false);
    expect(pluginManager.getPlugin(m.id)?.manifest.name).toBe("测试插件");
  });

  it("activate 真实执行 manifest.activate 入口（审计修复回归）", () => {
    const entry = vi.fn();
    const m = register(makeManifest({ activate: entry }));
    expect(pluginManager.activate(m.id)).toBe(true);
    expect(entry).toHaveBeenCalledTimes(1);
    expect(pluginManager.getPlugin(m.id)?.status).toBe("active");
  });

  it("入口抛错时状态置 error 且 activate 返回 false", () => {
    const m = register(
      makeManifest({
        activate: () => {
          throw new Error("boom");
        },
      }),
    );
    expect(pluginManager.activate(m.id)).toBe(false);
    expect(pluginManager.getPlugin(m.id)?.status).toBe("error");
    expect(pluginManager.getPlugin(m.id)?.error).toContain("boom");
  });

  it("deactivate 回到 installed；unregister 移除登记", () => {
    const m = register(makeManifest());
    pluginManager.activate(m.id);
    pluginManager.deactivate(m.id);
    expect(pluginManager.getPlugin(m.id)?.status).toBe("disabled"); // 归档语义：deactivate→disabled

    pluginManager.unregister(m.id);
    cleanupIds.pop();
    expect(pluginManager.getPlugin(m.id)).toBeUndefined();
  });

  it("激活未注册插件返回 false 不抛出；重复激活幂等", () => {
    expect(pluginManager.activate("no-such-plugin")).toBe(false);
    const m = register(makeManifest({ activate: vi.fn() }));
    pluginManager.activate(m.id);
    expect(pluginManager.activate(m.id)).toBe(true);
    expect(pluginManager.getPlugin(m.id)?.manifest).toBeDefined();
  });
});

describe("命令与事件总线", () => {
  it("activate 期间 registerCommand 登记，executeCommand 派发", () => {
    const handler = vi.fn();
    const m = register(
      makeManifest({
        activate: (context) => {
          context.commands.registerCommand("test.cmd.hello", handler);
        },
      }),
    );
    pluginManager.activate(m.id);

    const fullId = `${m.id}.test.cmd.hello`; // 注册键自动加 pluginId. 前缀
    expect(pluginManager.executeCommand(fullId)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(pluginManager.executeCommand("missing.cmd")).toBe(false);
    expect(pluginManager.executeCommand("test.cmd.hello")).toBe(false); // 无前缀不可达
  });

  it("事件总线 plugin:activated 通知与取消订阅", () => {
    const seen: string[] = [];
    const off = pluginManager.on("plugin:activated", (id: unknown) =>
      seen.push(String(id)),
    );

    const m = register(makeManifest());
    pluginManager.activate(m.id);
    expect(seen).toContain(m.id);

    off();
    pluginManager.deactivate(m.id);
    pluginManager.activate(m.id);
    expect(seen.filter((s) => s === m.id)).toHaveLength(1);
  });

  it("getRegisteredCommands 反映激活插件的命令注册", () => {
    const m = register(
      makeManifest({
        activate: (context) => context.commands.registerCommand("probe.cmd", () => {}),
      }),
    );
    pluginManager.activate(m.id);
    expect(pluginManager.getRegisteredCommands().has(`${m.id}.probe.cmd`)).toBe(true);
  });
});

describe("插件 API 沙箱面", () => {
  it("ui.showToast 经事件总线广播通知", () => {
    const notices: unknown[] = [];
    const off = pluginManager.on("notification", (n: unknown) => notices.push(n));

    const m = register(
      makeManifest({
        activate: (context) => context.ui.showToast("你好", "success"),
      }),
    );
    pluginManager.activate(m.id);
    off();

    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      message: "你好",
      type: "success",
      pluginId: m.id,
    });
  });

  it("ui.registerPanel/registerStatusBarItem 落到管理器登记表", () => {
    const m = register(
      makeManifest({
        activate: (context) => {
          context.ui.registerPanel("probe-panel", {
            title: "探针面板",
            render: () => null,
          });
          context.ui.registerStatusBarItem({ text: "probe" });
        },
      }),
    );
    pluginManager.activate(m.id);

    expect(pluginManager.getRegisteredPanels().has(`${m.id}:probe-panel`)).toBe(true);
    expect(
      pluginManager.getStatusBarItems().some((i) => i.text === "probe"),
    ).toBe(true);
  });

  it("storage 按插件隔离读写", () => {
    let roundtrip: unknown;
    const m = register(
      makeManifest({
        activate: (context) => {
          context.storage.set("k", { v: 42 });
          roundtrip = context.storage.get("k");
        },
      }),
    );
    pluginManager.activate(m.id);
    expect(roundtrip).toMatchObject({ v: 42 });
  });

  it("editor API 为集成期桩（getActiveFile→null 不抛出）", () => {
    let active: unknown = "unset";
    const m = register(
      makeManifest({
        activate: (context) => {
          active = context.editor.getActiveFile();
        },
      }),
    );
    pluginManager.activate(m.id);
    expect(active).toBeNull();
  });
});

describe("市场记录面", () => {
  it("getInstalledPlugins 返回本地安装记录结构", () => {
    const installed = pluginManager.getInstalledPlugins();
    expect(Array.isArray(installed)).toBe(true);
    installed.forEach((entry) => {
      expect(entry).toMatchObject({ id: expect.any(String), version: expect.any(String) });
    });
  });
});
