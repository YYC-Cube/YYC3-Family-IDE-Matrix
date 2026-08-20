/**
 * @file: FloatingPanels.test.tsx
 * @description: 浮动窗口功能单测 — 浮出/停坞/关闭/置顶/拖拽移动/渲染
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[panel-host],[floating]
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { LayoutNode } from "../PanelManagerContext";
import {
  PanelManagerProvider,
  usePanelManager,
} from "../PanelManagerContext";
import { PanelShell, PanelRegistryProvider } from "../PanelShell";

const leaf = (id: string, panelId: string): LayoutNode => ({
  id,
  type: "leaf",
  panelId,
  size: 50,
});

const tree: LayoutNode = {
  id: "root",
  type: "split",
  direction: "horizontal",
  children: [leaf("a", "code"), leaf("b", "preview")],
};

const panels = {
  code: ({ nodeId }: { nodeId: string }) => <div>代码-{nodeId}</div>,
  preview: () => <div>预览内容</div>,
};

/** 捕获上下文供直接调用编辑 API */
function Capture({ ctxRef }: { ctxRef: { current: ReturnType<typeof usePanelManager> | null } }) {
  ctxRef.current = usePanelManager();
  return null;
}

function Harness({ ctxRef }: { ctxRef?: { current: ReturnType<typeof usePanelManager> | null } }) {
  return (
    <PanelManagerProvider initialLayout={tree}>
      {ctxRef && <Capture ctxRef={ctxRef} />}
      <PanelRegistryProvider panels={panels}>
        <PanelShell />
      </PanelRegistryProvider>
    </PanelManagerProvider>
  );
}

function setup() {
  const ctxRef: { current: ReturnType<typeof usePanelManager> | null } = { current: null };
  render(<Harness ctxRef={ctxRef} />);
  return ctxRef;
}

describe("浮动窗口", () => {
  it("floatPanel 从布局移除叶子并以覆盖窗口渲染面板", () => {
    const ctxRef = setup();
    expect(screen.getByText(/代码-a/)).toBeDefined();

    act(() => ctxRef.current!.floatPanel("a"));

    // 布局中消失，浮动窗口中出现
    expect(screen.queryByText(/代码-a/)).toBeNull();
    const floating = document.querySelector("[data-floating-id]") as HTMLElement;
    expect(floating).not.toBeNull();
    expect(floating.dataset.panelId).toBe("code");
    // 窗口标题来自 PANEL_TITLES
    expect(screen.getAllByText("代码").length).toBeGreaterThanOrEqual(1);
  });

  it("dockFloating 将面板插回布局（首个叶子右侧）", () => {
    const ctxRef = setup();
    act(() => ctxRef.current!.floatPanel("b"));
    // 浮动窗口存在且承载 preview 面板
    const floating = document.querySelector("[data-floating-id]") as HTMLElement;
    expect(floating.dataset.panelId).toBe("preview");

    const fid = floating.dataset.floatingId!;
    act(() => ctxRef.current!.dockFloating(fid));

    // 窗口消失、面板回到布局渲染、浮动态清空
    expect(document.querySelector("[data-floating-id]")).toBeNull();
    expect(screen.getByText("预览内容")).toBeDefined();
    expect(ctxRef.current!.floatingPanels).toHaveLength(0);
  });

  it("closeFloating 丢弃面板且不回布局", () => {
    const ctxRef = setup();
    act(() => ctxRef.current!.floatPanel("a"));
    const fid = (document.querySelector("[data-floating-id]") as HTMLElement).dataset.floatingId!;

    act(() => ctxRef.current!.closeFloating(fid));
    expect(ctxRef.current!.floatingPanels).toHaveLength(0);
    expect(screen.queryByText(/代码/)).toBeNull();
  });

  it("多窗口 focusFloating 提升 z 序；moveFloating 移动位置", () => {
    const ctxRef = setup();
    act(() => {
      ctxRef.current!.floatPanel("a");
      ctxRef.current!.floatPanel("b");
    });
    const [first, second] = ctxRef.current!.floatingPanels;
    expect(second.z).toBeGreaterThan(first.z);

    // 置顶 first
    act(() => ctxRef.current!.focusFloating(first.id));
    expect(ctxRef.current!.floatingPanels[0].z).toBeGreaterThan(
      ctxRef.current!.floatingPanels[1].z,
    );

    // 移动（负值夹取为 0）
    act(() => ctxRef.current!.moveFloating(second.id, 120, -30));
    const moved = ctxRef.current!.floatingPanels.find((f) => f.id === second.id)!;
    expect(moved.x).toBe(120);
    expect(moved.y).toBe(0);
  });

  it("头部拖拽移动窗口位置（mousemove 模拟）", () => {
    const ctxRef = setup();
    act(() => ctxRef.current!.floatPanel("a"));
    const fid = (document.querySelector("[data-floating-id]") as HTMLElement).dataset.floatingId!;
    const header = document.querySelector("[data-floating-id] .cursor-move") as HTMLElement;

    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 130 });
    fireEvent.mouseUp(window);

    const moved = ctxRef.current!.floatingPanels.find((f) => f.id === fid)!;
    expect(moved.x).toBeGreaterThan(0);
    expect(moved.y).toBeGreaterThan(0);
  });

  it("面板槽头部浮出按钮触发 floatPanel", () => {
    const ctxRef = setup();
    expect(document.querySelector("[data-floating-id]")).toBeNull();
    fireEvent.click(screen.getAllByTitle("浮出为窗口")[0]);
    expect(document.querySelector("[data-floating-id]")).not.toBeNull();
  });
});
