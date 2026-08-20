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

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

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

  const setLayout = useCallback(
    (next: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => {
      setLayoutState((prev) =>
        typeof next === "function" ? next(prev) : next,
      );
    },
    [],
  );

  return (
    <PanelManagerContext.Provider value={{ layout, setLayout }}>
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
