/**
 * @file: PanelShell.test.tsx
 * @description: 面板壳三期单测 — 布局纯函数 + Shell 渲染 + 上下文编辑操作
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[panel-host],[shell],[layout]
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  findNode,
  findParent,
  splitNode,
  removeNode,
  insertPanelBeside,
  replacePanel,
  swapPanels,
  resizeSibling,

} from "../layout-ops";
import type { LayoutNode } from "../PanelManagerContext";
import {
  PanelManagerProvider,
  usePanelManager,
  LAYOUT_PRESETS,
} from "../PanelManagerContext";
import { PanelShell, PanelRegistryProvider } from "../PanelShell";

const leaf = (id: string, panelId: string, size = 50): LayoutNode => ({
  id,
  type: "leaf",
  panelId,
  size,
});

const tree: LayoutNode = {
  id: "root",
  type: "split",
  direction: "horizontal",
  children: [leaf("a", "code"), leaf("b", "preview")],
};

describe("layout-ops 纯函数", () => {
  it("findNode/findParent 定位节点与父级", () => {
    expect(findNode(tree, "b")?.panelId).toBe("preview");
    expect(findParent(tree, "b")?.id).toBe("root");
    expect(findNode(tree, "zzz")).toBeNull();
  });

  it("splitNode 把叶子变为等分 split 且不改原树", () => {
    const next = splitNode(tree, "a", "vertical", "terminal");
    expect(tree.children?.[0].type).toBe("leaf"); // 原树不变（纯函数）
    const newA = findNode(next, "a");
    const parent = next.children?.[0];
    expect(parent?.type).toBe("split");
    expect(parent?.direction).toBe("vertical");
    expect(parent?.children).toHaveLength(2);
    expect(newA?.size).toBe(50);
    expect(findNode(next, parent!.children![1].id)?.panelId).toBe("terminal");
  });

  it("removeNode 删除叶子并修剪单子 split（兄弟上提继承 id）", () => {
    const nested: LayoutNode = {
      id: "root",
      type: "split",
      direction: "horizontal",
      children: [
        { id: "s1", type: "split", direction: "vertical", children: [leaf("a", "code"), leaf("b", "preview")] },
        leaf("c", "terminal"),
      ],
    };
    const next = removeNode(nested, "b");
    // s1 只剩 a → 上提并继承 s1 的 id
    expect(next.children?.[0].id).toBe("s1");
    expect(next.children?.[0].type).toBe("leaf");
    expect(next.children?.[0].panelId).toBe("code");
  });

  it("removeNode 删除后单子上提为根叶子", () => {
    const next = removeNode(tree, "a");
    expect(next.type).toBe("leaf");
    expect(next.id).toBe("root"); // 上提继承父 id
    expect(next.panelId).toBe("preview");
  });

  it("insertPanelBeside 左侧插入（before 顺序）", () => {
    const next = insertPanelBeside(tree, "b", "git", "left");
    const parent = findParent(next, "b")!;
    expect(parent.direction).toBe("horizontal");
    expect(parent.children?.[0].panelId).toBe("git");
    expect(parent.children?.[1].panelId).toBe("preview");
  });

  it("insertPanelBeside 下方插入 → vertical", () => {
    const next = insertPanelBeside(tree, "a", "ops", "bottom");
    const parent = findParent(next, "a")!;
    expect(parent.direction).toBe("vertical");
    expect(parent.children?.[0].panelId).toBe("code");
    expect(parent.children?.[1].panelId).toBe("ops");
  });

  it("replacePanel 与 swapPanels 交换面板归属", () => {
    const replaced = replacePanel(tree, "a", "git");
    expect(findNode(replaced, "a")?.panelId).toBe("git");

    const swapped = swapPanels(tree, "a", "b");
    expect(findNode(swapped, "a")?.panelId).toBe("preview");
    expect(findNode(swapped, "b")?.panelId).toBe("code");
  });

  it("swapPanels 对同一节点/不存在节点为恒等操作", () => {
    expect(swapPanels(tree, "a", "a")).toBe(tree);
    expect(swapPanels(tree, "a", "zzz")).toBe(tree);
  });

  it("resizeSibling 在 10–90% 之间转移尺寸并夹取越界值", () => {
    const next = resizeSibling(tree, "root", 0, 10);
    expect(next.children?.[0].size).toBe(60);
    expect(next.children?.[1].size).toBe(40);

    const clamped = resizeSibling(tree, "root", 0, 999);
    expect(clamped.children?.[0].size).toBe(90);
    expect(clamped.children?.[1].size).toBe(10);
  });
});

// ── Shell 渲染与上下文集成 ──

function Probe({ actions }: { actions: ReturnType<typeof usePanelManager>["splitPanel"][] }) {
  return null;
}

describe("PanelShell（渲染 + 上下文编辑）", () => {
  const panels = {
    code: ({ nodeId }: { nodeId: string }) => <div>代码面板-{nodeId}</div>,
    preview: () => <div>预览面板</div>,
    terminal: () => <div>终端面板</div>,
  };

  function ShellHarness({
    initial = LAYOUT_PRESETS.default,
  }: {
    initial?: LayoutNode;
  }) {
    return (
      <PanelManagerProvider initialLayout={initial}>
        <PanelRegistryProvider panels={panels}>
          <PanelShell />
        </PanelRegistryProvider>
      </PanelManagerProvider>
    );
  }

  it("按布局树渲染已注册面板与未注册提示", () => {
    const custom: LayoutNode = {
      id: "root",
      type: "split",
      direction: "horizontal",
      children: [leaf("a", "code"), leaf("b", "nonexistent")],
    };
    render(<ShellHarness initial={custom} />);
    expect(screen.getByText(/代码面板-a/)).toBeDefined();
    expect(screen.getByText(/未注册面板：nonexistent/)).toBeDefined();
  });

  it("渲染已知面板标题与分隔条", () => {
    render(<ShellHarness initial={tree} />);
    expect(screen.getByText("代码")).toBeDefined();
    expect(screen.getByText("预览")).toBeDefined();
    expect(screen.getByTestId("divider-root-0")).toBeDefined();
  });

  it("Pin 固定后关闭按钮禁用，取消固定恢复", () => {
    render(<ShellHarness initial={tree} />);
    const pinBtn = screen.getAllByTitle("固定面板")[0];
    const closeBtn = pinBtn.parentElement!.querySelector("button[title='关闭']") as HTMLButtonElement;
    expect(closeBtn).not.toBeDisabled();

    fireEvent.click(pinBtn);
    expect(closeBtn).toBeDisabled();

    fireEvent.click(screen.getAllByTitle("取消固定")[0]);
    expect(closeBtn).not.toBeDisabled();
  });

  it("关闭叶子后该面板从渲染中消失", () => {
    render(<ShellHarness initial={tree} />);
    expect(screen.getByText("预览面板")).toBeDefined();
    fireEvent.click(screen.getAllByTitle("关闭")[1]);
    expect(screen.queryByText("预览面板")).toBeNull();
  });

  it("最大化后仅渲染目标面板，还原图标切换", () => {
    render(<ShellHarness initial={tree} />);
    fireEvent.click(screen.getAllByTitle("最大化")[0]);
    expect(screen.getByText("代码")).toBeDefined();
    expect(screen.queryByText("预览面板")).toBeNull();
    fireEvent.click(screen.getByTitle("还原"));
    expect(screen.getByText("预览面板")).toBeDefined();
  });
});

// 集成：上下文编辑操作驱动 Shell 重渲染
describe("PanelManagerContext 布局编辑操作", () => {
  it("splitPanel 经上下文驱动 Shell 渲染新面板", () => {
    let ctx: ReturnType<typeof usePanelManager> | null = null;
    const Capture = () => {
      ctx = usePanelManager();
      return null;
    };
    render(
      <PanelManagerProvider initialLayout={tree}>
        <Capture />
        <PanelRegistryProvider panels={{
          code: () => <div>代码面板</div>,
          preview: () => <div>预览面板</div>,
          terminal: () => <div>终端面板</div>,
        }}>
          <PanelShell />
        </PanelRegistryProvider>
      </PanelManagerProvider>,
    );

    expect(screen.queryByText("终端面板")).toBeNull();
    act(() => ctx!.splitPanel("a", "vertical", "terminal"));
    expect(screen.getByText("终端面板")).toBeDefined();

    act(() => ctx!.swapPanels("a", "b"));
    expect(screen.getAllByText(/面板/).length).toBeGreaterThanOrEqual(3);

    act(() => ctx!.resetLayout());
    expect(screen.queryByText("终端面板")).toBeNull();
  });
});
