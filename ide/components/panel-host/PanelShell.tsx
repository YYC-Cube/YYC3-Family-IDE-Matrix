/**
 * @file: PanelShell.tsx
 * @description: 面板壳渲染器（三期）— 布局树渲染/面板注册表/原生 DnD/分隔条拖拽/固定
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [panel-host],[shell],[renderer],[dnd],[phase-3]
 *
 * brief: 消费 PanelManagerContext 的布局树并渲染实际面板；
 *        面板经 PanelRegistryProvider 注册（panelId → 组件）
 *
 * usage:
 * ```tsx
 * <PanelManagerProvider>
 *   <PanelRegistryProvider panels={{ code: CodePanel, preview: PreviewPanel }}>
 *     <PanelShell />
 *   </PanelRegistryProvider>
 * </PanelManagerProvider>
 * ```
 */

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { ComponentType, DragEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Pin, PinOff, Maximize2, Minimize2, X, Dock, GripVertical, PictureInPicture2 } from "lucide-react";
import {
  usePanelManager,
  type LayoutNode,
  type PanelId,
  type FloatingPanelState,
} from "./PanelManagerContext";
import { findNode } from "./layout-ops";

// ── 面板注册表 ──

export type PanelComponent = ComponentType<{ nodeId: string }>;

const PanelRegistryContext = createContext<ReadonlyMap<string, PanelComponent> | null>(
  null,
);

export function PanelRegistryProvider({
  panels,
  children,
}: {
  panels: Record<string, PanelComponent>;
  children: ReactNode;
}) {
  const registry = useMemo(
    () => new Map(Object.entries(panels)),
    [panels],
  );
  return (
    <PanelRegistryContext.Provider value={registry}>
      {children}
    </PanelRegistryContext.Provider>
  );
}

function usePanelRegistry(): ReadonlyMap<string, PanelComponent> {
  return useContext(PanelRegistryContext) ?? new Map();
}

// ── 标题映射（已知面板；未注册 id 原样展示）──

const PANEL_TITLES: Record<string, string> = {
  ai: "AI 对话",
  files: "文件",
  code: "代码",
  preview: "预览",
  terminal: "终端",
  git: "Git",
  agents: "Agent 编排",
  market: "Agent 市场",
  knowledge: "知识库",
  rag: "RAG",
  collab: "协作",
  ops: "运维",
};

/** DnD 数据类型 */
const DRAG_TYPE = "application/x-yyc3-panel";

export function PanelShell({ className = "" }: { className?: string }) {
  const { layout, maximizedPanel } = usePanelManager();
  const target =
    maximizedPanel !== null
      ? (findNode(layout, maximizedPanel) ?? layout)
      : layout;

  return (
    <div
      className={`panel-host-root relative size-full min-h-0 bg-[var(--ide-bg)] ${className}`}
    >
      <LayoutRenderer node={target} />
      <FloatingLayer />
    </div>
  );
}

// ── 浮动窗口层（三期补完）──

function FloatingLayer() {
  const { floatingPanels } = usePanelManager();
  if (floatingPanels.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {floatingPanels.map((fp) => (
        <FloatingWindow key={fp.id} floating={fp} />
      ))}
    </div>
  );
}

function FloatingWindow({ floating }: { floating: FloatingPanelState }) {
  const registry = usePanelRegistry();
  const { dockFloating, closeFloating, focusFloating, moveFloating } =
    usePanelManager();
  const Panel = registry.get(floating.panelId);
  const title = PANEL_TITLES[floating.panelId] ?? floating.panelId;

  const onHeaderPointerDown = (
    e: ReactMouseEvent<HTMLDivElement>,
  ) => {
    if ((e.target as HTMLElement).closest("button")) return; // 按钮不触发拖拽
    e.preventDefault();
    focusFloating(floating.id);
    const startX = e.clientX - floating.x;
    const startY = e.clientY - floating.y;
    const onMove = (ev: globalThis.MouseEvent) =>
      moveFloating(floating.id, ev.clientX - startX, ev.clientY - startY);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      data-floating-id={floating.id}
      data-panel-id={floating.panelId}
      className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border border-[var(--ide-border-mid)] bg-[var(--ide-bg)] shadow-2xl shadow-black/50"
      style={{ left: floating.x, top: floating.y, width: floating.w, height: floating.h, zIndex: floating.z }}
      onMouseDown={() => focusFloating(floating.id)}
    >
      <div
        onMouseDown={onHeaderPointerDown}
        className="flex h-7 flex-shrink-0 cursor-move items-center gap-1 border-b border-[var(--ide-border-dim)] bg-[var(--ide-bg-elevated)] px-2 select-none"
      >
        <GripVertical className="h-3 w-3 text-slate-600" />
        <span className="truncate text-[0.68rem] font-medium text-slate-400">{title}</span>
        <div className="flex-1" />
        <button
          title="停坞回布局"
          onClick={() => dockFloating(floating.id)}
          className="p-0.5 text-slate-600 hover:text-cyan-400"
        >
          <Dock className="h-3 w-3" />
        </button>
        <button
          title="关闭"
          onClick={() => closeFloating(floating.id)}
          className="p-0.5 text-slate-600 hover:text-red-400"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {Panel ? (
          <Panel nodeId={floating.id} />
        ) : (
          <div className="flex size-full items-center justify-center text-[0.62rem] text-slate-600">
            未注册面板：{floating.panelId}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 布局递归渲染 ──

function LayoutRenderer({ node }: { node: LayoutNode }) {
  if (node.type === "leaf") {
    return <PanelSlot nodeId={node.id} panelId={node.panelId} />;
  }

  const horizontal = node.direction === "horizontal";
  return (
    <div
      className={`flex size-full min-h-0 min-w-0 ${horizontal ? "flex-row" : "flex-col"}`}
    >
      {(node.children ?? []).map((child, index) => (
        <div
          key={child.id}
          className="flex min-h-0 min-w-0"
          style={{ flexBasis: `${child.size ?? 100 / (node.children?.length ?? 1)}%`, flexGrow: 0, flexShrink: 1 }}
        >
          <div className="size-full min-h-0 min-w-0">
            <LayoutRenderer node={child} />
          </div>
        </div>
      )).reduce<ReactNode[]>((acc, element, index, all) => {
        acc.push(element);
        if (index < all.length - 1) {
          acc.push(
            <Divider key={`divider-${index}`} parentId={node.id} index={index} horizontal={horizontal} />,
          );
        }
        return acc;
      }, [])}
    </div>
  );
}

/** 分隔条：鼠标拖拽调整相邻兄弟尺寸 */
function Divider({
  parentId,
  index,
  horizontal,
}: {
  parentId: string;
  index: number;
  horizontal: boolean;
}) {
  const { resizeSibling } = usePanelManager();
  const containerRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const container = containerRef.current?.parentElement;
      if (!container) return;
      const total = horizontal ? container.clientWidth : container.clientHeight;
      if (total <= 0) return;
      const startPos = horizontal ? e.clientX : e.clientY;
      let lastDelta = 0;

      const onMove = (ev: globalThis.MouseEvent) => {
        const pos = horizontal ? ev.clientX : ev.clientY;
        const nextDelta = ((pos - startPos) / total) * 100;
        const step = nextDelta - lastDelta;
        lastDelta = nextDelta;
        resizeSibling(parentId, index, step);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [horizontal, index, parentId, resizeSibling],
  );

  return (
    <div
      ref={containerRef}
      onMouseDown={onPointerDown}
      className={`flex-shrink-0 bg-[var(--ide-border-mid)] hover:bg-cyan-500/60 transition-colors ${
        horizontal ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"
      }`}
      data-testid={`divider-${parentId}-${index}`}
    />
  );
}

// ── 叶子槽：Tab 头 + 面板体 + 原生 DnD ──

function PanelSlot({ nodeId, panelId }: { nodeId: string; panelId?: PanelId }) {
  const registry = usePanelRegistry();
  const {
    swapPanels,
    removePanel,
    floatPanel,
    maximizedPanel,
    setMaximizedPanel,
    pinnedPanels,
    togglePin,
  } = usePanelManager();

  const pinned = panelId ? pinnedPanels.has(panelId) : false;
  const Panel = panelId ? registry.get(panelId) : undefined;
  const title = panelId ? (PANEL_TITLES[panelId] ?? panelId) : "（空）";
  const isMaximized = maximizedPanel === nodeId;

  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData(DRAG_TYPE, nodeId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sourceNodeId = e.dataTransfer.getData(DRAG_TYPE);
    if (sourceNodeId && sourceNodeId !== nodeId) {
      swapPanels(sourceNodeId, nodeId);
    }
  };

  return (
    <div
      className="flex size-full min-h-0 min-w-0 flex-col border border-[var(--ide-border-faint)]"
      data-node-id={nodeId}
      data-panel-id={panelId}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div
        draggable
        onDragStart={onDragStart}
        className="flex h-7 flex-shrink-0 cursor-grab items-center gap-1 border-b border-[var(--ide-border-dim)] bg-[var(--ide-bg-elevated)] px-2 select-none"
      >
        <span className="truncate text-[0.68rem] font-medium text-slate-400">
          {title}
        </span>
        <div className="flex-1" />
        <button
          title="浮出为窗口"
          onClick={() => floatPanel(nodeId)}
          className="p-0.5 text-slate-600 hover:text-slate-400"
        >
          <PictureInPicture2 className="h-3 w-3" />
        </button>
        <button
          title={pinned ? "取消固定" : "固定面板"}
          onClick={() => panelId && togglePin(panelId)}
          className={`p-0.5 ${pinned ? "text-cyan-400" : "text-slate-600 hover:text-slate-400"}`}
        >
          {pinned ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
        </button>
        <button
          title={isMaximized ? "还原" : "最大化"}
          onClick={() => setMaximizedPanel(isMaximized ? null : nodeId)}
          className="p-0.5 text-slate-600 hover:text-slate-400"
        >
          {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </button>
        <button
          title="关闭"
          disabled={pinned}
          onClick={() => removePanel(nodeId)}
          className="p-0.5 text-slate-600 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        {Panel ? (
          <Panel nodeId={nodeId} />
        ) : (
          <div className="flex size-full items-center justify-center text-[0.62rem] text-slate-600">
            未注册面板：{panelId ?? "—"}
          </div>
        )}
      </div>
    </div>
  );
}
