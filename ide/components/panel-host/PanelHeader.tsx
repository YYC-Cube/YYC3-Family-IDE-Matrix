/**
 * @file: PanelHeader.tsx
 * @description: 面板宿主 — 面板顶部标题栏的解耦最小实现（无 dnd/pin/floating 依赖）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: panel,host,header,abstraction
 *
 * brief: 面板宿主抽象（1.5 批）——替代单体 PanelManager 的 PanelHeader 依赖
 *
 * details:
 * - 单体 PanelHeader 耦合 usePanelManager/react-dnd/pin/floating 一整套宿主，
 *  阻塞了 AgentMarket/AgentOrchestrator 等面板回迁（见 archive/MIGRATION.md）
 * - 本组件保持调用方 API 兼容（nodeId/panelId/title/icon/children），
 *  但 nodeId/panelId 仅作 data 属性透出，交由未来完整面板壳接管拖拽/固定
 * - 视觉沿用 --ide-* 令牌（见同目录 tokens.css）
 *
 * usage:
 * ```tsx
 * <PanelHeader
 *   panelId="market"
 *   title="Agent 市场"
 *   icon={<Store className="w-3 h-3 text-amber-400/70" />}
 * >
 *   <button>刷新</button>  （右侧动作区）
 * </PanelHeader>
 * ```
 */

import type { ReactNode } from "react";

export interface PanelHeaderProps {
  /** 宿主节点 id（面板壳接入拖拽时使用，此处仅透出为 data 属性） */
  nodeId?: string;
  /** 面板类型 id（同上） */
  panelId?: string;
  /** 面板标题 */
  title: string;
  /** 标题图标（小尺寸，调用方控制 className） */
  icon?: ReactNode;
  /** 右侧动作区（按钮/状态等） */
  children?: ReactNode;
}

export function PanelHeader({
  nodeId,
  panelId,
  title,
  icon,
  children,
}: PanelHeaderProps) {
  return (
    <div
      data-node-id={nodeId}
      data-panel-id={panelId}
      className="flex-shrink-0 flex items-center gap-1.5 h-7 px-2.5 border-b border-[var(--ide-border-dim)] bg-[var(--ide-bg-elevated)]"
    >
      {icon}
      <span className="text-[0.68rem] text-slate-400 font-medium truncate">
        {title}
      </span>
      <div className="flex-1" />
      {children && (
        <div className="flex items-center gap-1 text-slate-500">{children}</div>
      )}
    </div>
  );
}

export default PanelHeader;
