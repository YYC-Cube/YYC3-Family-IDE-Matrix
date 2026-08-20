/**
 * @file: types.ts
 * @description: 面板宿主共享类型 — 布局树（审计架构#2 断环：Context 与 layout-ops 单向引用本文件）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [panel-host],[types],[layout]
 */

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
