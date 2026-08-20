/**
 * @file: PanelManagerContext.tsx
 * @description: 面板管理上下文（面板壳二期）— 布局树状态 + 预设 + 上下文 Hook
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [panel-host],[layout],[context],[phase-2]
 *
 * brief: 从单体 PanelManager 抽取的布局上下文最小闭环 —— 消费方（如
 *        LayoutPresetsEnhanced）无需拖入 dnd/pin/floating 完整面板壳
 *
 * details:
 * - LayoutNode/SplitDirection/LAYOUT_PRESETS 与归档 PanelManager 保持同构
 * - 上下文先提供 layout/setLayout（归档消费面实测仅用此二者）；
 *   split/merge 等编辑能力由三期面板壳在此上下文上扩展
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LayoutNode, SplitDirection, PanelId } from "./types";
import {
  findNode,
  genNodeId,
  insertPanelBeside,
  removeNode,
  replacePanel as replacePanelOp,
  resizeSibling as resizeSiblingOp,
  splitNode,
  swapPanels as swapPanelsOp,
} from "./layout-ops";

// ── 类型（与归档 PanelManager 同构）──

export type { LayoutNode, SplitDirection, PanelId } from "./types";
// ── 布局预设（归档版同构）──

const DEFAULT_LAYOUT: LayoutNode = {
  id: "root",
  type: "split",
  direction: "horizontal",
  children: [
    { id: "left", type: "leaf", panelId: "ai", size: 35 },
    { id: "center", type: "leaf", panelId: "files", size: 35 },
    { id: "right", type: "leaf", panelId: "code", size: 30 },
  ],
};

export const LAYOUT_PRESETS: Record<string, LayoutNode> = {
  designer: DEFAULT_LAYOUT,
  "ai-workspace": {
    id: "root",
    type: "split",
    direction: "horizontal",
    children: [
      { id: "left", type: "leaf", panelId: "ai", size: 40 },
      {
        id: "right-split",
        type: "split",
        direction: "vertical",
        children: [
          { id: "top-right", type: "leaf", panelId: "code", size: 60 },
          { id: "bottom-right", type: "leaf", panelId: "preview", size: 40 },
        ],
      },
    ],
  },
  default: DEFAULT_LAYOUT,
};

// ── 上下文 ──

export interface PanelManagerContextValue {
  /** 当前布局树 */
  layout: LayoutNode;
  /** 设置布局树（支持函数式更新） */
  setLayout: (layout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => void;
  // ── 三期：布局编辑 ──
  /** 分裂叶子：原面板与新面板各占 50% */
  splitPanel: (nodeId: string, direction: SplitDirection, newPanelId: PanelId) => void;
  /** 邻位插入面板（merge 语义） */
  mergePanel: (
    targetNodeId: string,
    panelId: PanelId,
    position: "left" | "right" | "top" | "bottom",
  ) => void;
  /** 删除叶子节点（修剪空 split，兄弟继承尺寸） */
  removePanel: (nodeId: string) => void;
  /** 替换叶子的面板 */
  replacePanel: (nodeId: string, panelId: PanelId) => void;
  /** 交换两个叶子的面板（DnD 落点语义） */
  swapPanels: (nodeIdA: string, nodeIdB: string) => void;
  /** 同层相邻尺寸调整（分隔条拖拽） */
  resizeSibling: (parentId: string, index: number, deltaPercent: number) => void;
  /** 重置为初始布局 */
  resetLayout: () => void;
  // ── 三期：最大化与固定 ──
  /** 当前最大化面板节点 id（null 为常规布局） */
  maximizedPanel: string | null;
  setMaximizedPanel: (nodeId: string | null) => void;
  /** 已固定的面板 id 集合（固定者不参与关闭/替换） */
  pinnedPanels: ReadonlySet<string>;
  togglePin: (panelId: string) => void;
  // ── 三期补完：浮动窗口 ──
  /** 浮动窗口列表（面板脱离布局树，以覆盖窗口呈现） */
  floatingPanels: FloatingPanelState[];
  /** 将叶子面板浮出为窗口（从布局树移除） */
  floatPanel: (nodeId: string, size?: { w: number; h: number }) => void;
  /** 浮动窗口停坞回布局（插入首个叶子右侧；布局空则成为根叶子） */
  dockFloating: (floatingId: string) => void;
  /** 关闭浮动窗口（面板丢弃，不回布局） */
  closeFloating: (floatingId: string) => void;
  /** 置顶浮动窗口（z 轴提升） */
  focusFloating: (floatingId: string) => void;
  /** 移动浮动窗口位置 */
  moveFloating: (floatingId: string, x: number, y: number) => void;
}

/** 浮动窗口状态 */
export interface FloatingPanelState {
  /** 窗口实例 id（float_ 前缀） */
  id: string;
  /** 窗口承载的面板 id */
  panelId: PanelId;
  /** 位置与尺寸（px） */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 层叠序 */
  z: number;
}

/** 深度优先取首个叶子（dockFloating 的插入锚点） */
function firstLeaf(node: LayoutNode): LayoutNode | null {
  if (node.type === "leaf") return node;
  for (const child of node.children ?? []) {
    const hit = firstLeaf(child);
    if (hit) return hit;
  }
  return null;
}

const PanelManagerContext = createContext<PanelManagerContextValue | null>(null);

export function PanelManagerProvider({
  initialLayout = DEFAULT_LAYOUT,
  children,
}: {
  initialLayout?: LayoutNode;
  children: ReactNode;
}) {
  const [layout, setLayoutState] = useState<LayoutNode>(initialLayout);
  const [maximizedPanel, setMaximizedPanel] = useState<string | null>(null);
  const [pinned, setPinned] = useState<ReadonlySet<string>>(new Set());
  const [floating, setFloating] = useState<FloatingPanelState[]>([]);
  const zCounterRef = useRef(10);

  const setLayout = useCallback(
    (next: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => {
      setLayoutState((prev) =>
        typeof next === "function" ? next(prev) : next,
      );
    },
    [],
  );

  const applyOp = useCallback(
    (fn: (prev: LayoutNode) => LayoutNode) => setLayoutState(fn),
    [],
  );

  const value = useMemo<PanelManagerContextValue>(
    () => ({
      layout,
      setLayout,
      splitPanel: (nodeId, direction, newPanelId) =>
        applyOp((prev) => splitNode(prev, nodeId, direction, newPanelId)),
      mergePanel: (targetNodeId, panelId, position) =>
        applyOp((prev) => insertPanelBeside(prev, targetNodeId, panelId, position)),
      removePanel: (nodeId) => applyOp((prev) => removeNode(prev, nodeId)),
      replacePanel: (nodeId, panelId) =>
        applyOp((prev) => replacePanelOp(prev, nodeId, panelId)),
      swapPanels: (nodeIdA, nodeIdB) =>
        applyOp((prev) => swapPanelsOp(prev, nodeIdA, nodeIdB)),
      resizeSibling: (parentId, index, deltaPercent) =>
        applyOp((prev) => resizeSiblingOp(prev, parentId, index, deltaPercent)),
      resetLayout: () => {
        setLayoutState(initialLayout);
        setMaximizedPanel(null);
      },
      maximizedPanel,
      setMaximizedPanel,
      pinnedPanels: pinned,
      togglePin: (panelId) =>
        setPinned((prev) => {
          const next = new Set(prev);
          if (next.has(panelId)) next.delete(panelId);
          else next.add(panelId);
          return next;
        }),
      // ── 浮动窗口 ──
      floatingPanels: floating,
      floatPanel: (nodeId, size) => {
        const leaf = findNode(layout, nodeId);
        const panelId = leaf?.panelId;
        if (!panelId) return;
        applyOp((prev) => removeNode(prev, nodeId));
        setFloating((prev) => [
          ...prev,
          {
            id: genNodeId("float"),
            panelId,
            x: 40 + prev.length * 24,
            y: 40 + prev.length * 24,
            w: size?.w ?? 480,
            h: size?.h ?? 360,
            z: ++zCounterRef.current,
          },
        ]);
      },
      dockFloating: (floatingId) => {
        setFloating((prev) => {
          const target = prev.find((f) => f.id === floatingId);
          if (!target) return prev;
          applyOp((cur) => {
            const first = firstLeaf(cur);
            return first
              ? insertPanelBeside(cur, first.id, target.panelId, "right")
              : { id: "root", type: "leaf", panelId: target.panelId };
          });
          return prev.filter((f) => f.id !== floatingId);
        });
      },
      closeFloating: (floatingId) =>
        setFloating((prev) => prev.filter((f) => f.id !== floatingId)),
      focusFloating: (floatingId) =>
        setFloating((prev) =>
          prev.map((f) =>
            f.id === floatingId ? { ...f, z: ++zCounterRef.current } : f,
          ),
        ),
      moveFloating: (floatingId, x, y) =>
        setFloating((prev) =>
          prev.map((f) =>
            f.id === floatingId
              ? { ...f, x: Math.max(0, x), y: Math.max(0, y) }
              : f,
          ),
        ),
    }),
    [layout, setLayout, applyOp, initialLayout, maximizedPanel, pinned, floating],
  );

  return (
    <PanelManagerContext.Provider value={value}>
      {children}
    </PanelManagerContext.Provider>
  );
}

export function usePanelManager(): PanelManagerContextValue {
  const ctx = useContext(PanelManagerContext);
  if (!ctx) {
    throw new Error("usePanelManager must be used within PanelManagerProvider");
  }
  return ctx;
}
