/**
 * @file: index.ts
 * @description: 面板宿主统一出口 — PanelHeader + 令牌样式
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [panel-host],[index],[barrel]
 *
 * brief: 面板宿主抽象单一入口；import 本模块即自动注入 --ide-* 令牌
 *
 * notes: 未来完整面板壳（拖拽/固定/浮动）在此扩展，消费方面板无需改动
 */

import "./tokens.css";

export { PanelHeader } from "./PanelHeader";
export type { PanelHeaderProps } from "./PanelHeader";

// 面板壳二期：布局上下文；三期：布局编辑 + 渲染器
export {
  PanelManagerProvider,
  usePanelManager,
  LAYOUT_PRESETS,
} from "./PanelManagerContext";
export type {
  PanelManagerContextValue,
} from "./PanelManagerContext";
export type { LayoutNode, SplitDirection, PanelId } from "./types";

export { PanelShell, PanelRegistryProvider } from "./PanelShell";
export type { PanelComponent } from "./PanelShell";
export * from "./layout-ops";
