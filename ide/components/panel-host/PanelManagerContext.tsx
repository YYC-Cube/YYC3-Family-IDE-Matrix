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

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  insertPanelBeside,
  removeNode,
  replacePanel as replacePanelOp,
  resizeSibling as resizeSiblingOp,
  splitNode,
  swapPanels as swapPanelsOp,
} from "./layout-ops";

// ── 类型（与归档 PanelManager 同构）──

export type SplitDirection = "horizontal" | "vertical";

export type PanelId =
  | "ai"
  | "files"
  | "code"
  | "preview"
  | "terminal"
  | "git"
  | "agents"
  | "market"
  | "knowledge"
  | "rag"
  | "collab"
  | "ops"
  | (string & {}); // 开放联合：允许业务扩展面板 id，同时保留已知 id 的补全

export interface LayoutNode {
  id: string;
  type: "leaf" | "split";
  panelId?: PanelId;
  direction?: SplitDirection;
  children?: LayoutNode[];
  size?: number; // percentage
}

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
    }),
    [layout, setLayout, applyOp, initialLayout, maximizedPanel, pinned],
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
