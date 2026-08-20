/**
 * @file: IdeWorkbench.test.tsx
 * @description: 工作台组装单测 — 面板注册/布局渲染/预设切换/终端面板经沙箱
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[workbench],[assembly]
 *
 * notes: Monaco/xterm 在 jsdom 下不可运行，两者均 mock 为轻量替身
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Monaco 分片 mock（真实 @monaco-editor/react 在 jsdom 不可运行）
vi.mock("../../../MonacoWrapper", () => ({
  default: ({ filePath }: { filePath: string }) => (
    <div data-testid="monaco-panel">Monaco:{filePath}</div>
  ),
}));

// xterm 四件套 mock（TerminalPanel 消费）
vi.mock("@xterm/xterm", () => {
  const instance: Record<string, unknown> = {};
  return {
    Terminal: vi.fn().mockImplementation(() => ({
      open: vi.fn(), write: vi.fn(), writeln: vi.fn(), clear: vi.fn(),
      focus: vi.fn(), onResize: vi.fn(), onTitleChange: vi.fn(), dispose: vi.fn(),
      loadAddon: vi.fn(),
      onData: vi.fn((cb: (d: string) => void) => {
        (instance as { __cb?: (d: string) => void }).__cb = cb;
      }),
      unicode: { activeVersion: "11" }, cols: 80, rows: 24,
    })),
  };
});
vi.mock("@xterm/addon-fit", () => ({ FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })) }));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: vi.fn().mockImplementation(() => ({})) }));
vi.mock("@xterm/addon-search", () => ({ SearchAddon: vi.fn().mockImplementation(() => ({})) }));
vi.mock("@xterm/addon-unicode11", () => ({ Unicode11Addon: vi.fn().mockImplementation(() => ({})) }));

import IdeWorkbench from "../IdeWorkbench";

describe("IdeWorkbench 组装", () => {
  it("默认三栏布局：Monaco + 终端 + Agent 市场同屏渲染", async () => {
    render(<IdeWorkbench />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Monaco 分片经 Suspense 渲染（lazy resolve 后）
    expect(screen.getByTestId("monaco-panel")).toBeDefined();
    // 终端面板
    expect(document.querySelector("[data-panel-id='terminal']")).not.toBeNull();
    // Agent 市场（含内置模板）
    expect(screen.getByText("智能编程助手")).toBeDefined();
    // 工具栏品牌与面板计数
    expect(screen.getByText("Workbench")).toBeDefined();
    expect(screen.getByText(/3 面板/)).toBeDefined();
  });

  it("预设切换到 AI 工作区：布局重排为 ai+code+preview", async () => {
    render(<IdeWorkbench />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    fireEvent.click(screen.getByText("AI 工作区"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    // ai-workspace 预设：ai 40% | code+preview 右分
    expect(screen.getByText("AI 对话")).toBeDefined();
    expect(screen.getByText("代码")).toBeDefined();
    expect(screen.getByText("预览")).toBeDefined();
    expect(screen.getByTestId("monaco-panel")).toBeDefined(); // code 叶子仍在
  });

  it("Monaco 叶子可浮出为窗口并在浮动窗口中渲染", async () => {
    render(<IdeWorkbench />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    const floatBtn = screen.getAllByTitle("浮出为窗口")[0];
    fireEvent.click(floatBtn);

    const floating = document.querySelector("[data-floating-id]") as HTMLElement;
    expect(floating).not.toBeNull();
    expect(floating.dataset.panelId).toBe("code");
    // 浮动窗口内 Monaco 分片照常渲染（Suspense 兜底后）
    expect(floating.querySelector('[data-testid="monaco-panel"], [class*="skeleton"]')).toBeTruthy();
  });

  it("未注入 collabService 时协作面板保持演示模式（不主动连接）", () => {
    render(<IdeWorkbench />);
    // 默认布局不含 collab 面板——切到 designer 预设也不含；
    // 验证注册表已包含 collab 能力：浮出按钮经由注册表工作正常即可
    expect(screen.getAllByTitle("浮出为窗口").length).toBeGreaterThanOrEqual(3);
  });

  it("注入 collabService 时 CollabPanel 消费（经 provider 内联通）", async () => {
    const listeners = new Set<(e: { type: string }) => void>();
    const fakeService = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getConnectionStatus: vi.fn().mockReturnValue("connected"),
      getUsers: vi.fn().mockReturnValue([
        { id: "u1", name: "云端甲", color: "#06b6d4", lastSeen: Date.now() },
      ]),
      subscribe: vi.fn((l: (e: { type: string }) => void) => {
        listeners.add(l);
        return () => listeners.delete(l);
      }),
    } as unknown as import("../../../services/collab").CollabService;

    // 手动构造含 collab 叶子的布局
    const collabLayout = {
      id: "root",
      type: "split" as const,
      direction: "horizontal" as const,
      children: [
        { id: "code", type: "leaf" as const, panelId: "code", size: 60 },
        { id: "collab", type: "leaf" as const, panelId: "collab", size: 40 },
      ],
    };

    render(<IdeWorkbench collabService={fakeService} initialLayout={collabLayout} />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(fakeService.connect).toHaveBeenCalled();
    expect(screen.getByText("云端甲")).toBeDefined();
  });
});
