/**
 * @file: IdeWorkbench.tsx
 * @description: IDE 工作台组装 — Monaco 编辑器 × PanelShell × 真实面板首次合体
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [workbench],[assembly],[monaco],[panel-shell]
 *
 * brief: 组装期收官 —— 把回迁的真实面板接入三期面板壳：
 *        Monaco（LazyMonaco 懒加载）+ 沙箱化终端 + Agent 市场 + 协作面板
 *
 * usage:
 * ```tsx
 * <IdeWorkbench />
 *
 * // 可选注入协作服务（Yjs 胶水版）
 * <IdeWorkbench collabService={createCollabServiceFromConfig()} />
 * ```
 */

import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import { Boxes, FileCode } from "lucide-react";

import {
  PanelManagerProvider,
  PanelRegistryProvider,
  PanelShell,
  LAYOUT_PRESETS,
  usePanelManager,
  type LayoutNode,
} from "../panel-host";
import { ModelRegistryProvider } from "../agent/ModelRegistry";
import { SandboxedTerminalPanel } from "../terminal/TerminalPanel";
import AgentMarket from "../agent/AgentMarket";
import CollabPanel from "../../CollabPanel";
import FileExplorer from "./FileExplorer";
import SandpackPreview from "../../SandpackPreview";
import EditorTabs from "./EditorTabs";
import { useFileStoreZustand } from "../../stores/useFileStoreZustand";
import { preloadMonaco } from "../../LazyMonaco";
import type { CollabService } from "../../services/collab";

// Monaco 按需分片（@monaco-editor/react 全量 ~2MB，绝不含进首屏）
const MonacoWrapper = lazy(() => import("../../MonacoWrapper"));

// ── Monaco 编辑面板（桥接 nodeId 契约 ↔ MonacoWrapper props）──

function MonacoPanel({ nodeId }: { nodeId: string }) {
  const { fileContents, currentFilePath, updateFile } = useFileStoreZustand();

  const content = currentFilePath ? fileContents[currentFilePath] ?? "" : "";
  const fileName = currentFilePath?.split("/").pop() ?? "untitled";

  return (
    <div className="flex size-full flex-col">
      <EditorTabs />
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div
              data-testid="monaco-skeleton"
              className="flex size-full items-center justify-center bg-[var(--ide-bg)] text-[0.65rem] text-slate-600"
            >
              Monaco 分片加载中…
            </div>
          }
        >
          {currentFilePath ? (
            <MonacoWrapper
              filePath={currentFilePath}
              value={content}
              onChange={(v) => updateFile(currentFilePath, v ?? "")}
              height="100%"
              minimap={false}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-[var(--ide-bg)] text-[0.7rem] text-slate-600">
              <div className="flex flex-col items-center gap-2">
                <FileCode className="h-8 w-8 text-slate-700" />
                <span>从左侧文件浏览器打开文件</span>
              </div>
            </div>
          )}
        </Suspense>
      </div>
      {/* 状态栏 */}
      <div className="flex h-6 flex-shrink-0 items-center gap-3 border-t border-[var(--ide-border-faint)] bg-[var(--ide-bg-elevated)] px-3 text-[0.58rem] text-slate-600">
        <span>{currentFilePath ?? "—"}</span>
        <span>{fileName.split(".").pop()?.toUpperCase() ?? "TXT"}</span>
        <span>{content.split("\n").length} 行</span>
        <span>{content.length} 字符</span>
      </div>
    </div>
  );
}

// ── 预设切换工具栏（消费 PanelManagerContext）──

function PresetToolbar() {
  const { layout, setLayout } = usePanelManager();
  const [active, setActive] = useState("default");

  const switchTo = useCallback(
    (name: keyof typeof LAYOUT_PRESETS) => {
      // 深拷贝隔离预设模板（避免 setLayout 污染共享常量）
      setLayout(JSON.parse(JSON.stringify(LAYOUT_PRESETS[name])) as LayoutNode);
      setActive(name);
    },
    [setLayout],
  );

  return (
    <div className="flex h-8 flex-shrink-0 items-center gap-1.5 border-b border-[var(--ide-border-dim)] bg-[var(--ide-bg-elevated)] px-2">
      <Boxes className="h-3.5 w-3.5 text-cyan-400/80" />
      <span className="text-[0.7rem] font-medium text-slate-300">YYC³</span>
      <span className="text-[0.6rem] text-slate-600">Workbench</span>
      <div className="mx-2 h-4 w-px bg-[var(--ide-border-mid)]" />
      {(Object.keys(LAYOUT_PRESETS) as Array<keyof typeof LAYOUT_PRESETS>).map(
        (name) => (
          <button
            key={name}
            onClick={() => switchTo(name)}
            className={`rounded px-2 py-0.5 text-[0.62rem] transition-colors ${
              active === name
                ? "bg-cyan-600/30 text-cyan-300"
                : "text-slate-600 hover:bg-white/5 hover:text-slate-400"
            }`}
          >
            {name === "default" ? "默认" : name === "designer" ? "设计" : "AI 工作区"}
          </button>
        ),
      )}
      <div className="flex-1" />
      <span className="text-[0.55rem] text-slate-700">
        {countLeaves(layout)} 面板 · 拖拽标签页交换 · 拖分隔条调宽
      </span>
    </div>
  );
}

function countLeaves(node: LayoutNode): number {
  if (node.type === "leaf") return 1;
  return (node.children ?? []).reduce((sum, c) => sum + countLeaves(c), 0);
}

// ── 工作台主体 ──

export interface IdeWorkbenchProps {
  /** 注入协作服务（Yjs 胶水版）；缺省 CollabPanel 保持演示模式 */
  collabService?: CollabService;
  /** 初始布局（默认三栏：Monaco | 终端 | Agent 市场） */
  initialLayout?: LayoutNode;
}

/** 工作台默认布局：Monaco 左 / 终端右上 / Agent 市场右下 */
const WORKBENCH_LAYOUT: LayoutNode = {
  id: "root",
  type: "split",
  direction: "horizontal",
  children: [
    { id: "files", type: "leaf", panelId: "files", size: 18 },
    { id: "editor", type: "leaf", panelId: "code", size: 47 },
    {
      id: "right",
      type: "split",
      direction: "vertical",
      children: [
        { id: "term", type: "leaf", panelId: "terminal", size: 55 },
        { id: "market", type: "leaf", panelId: "market", size: 25 },
        { id: "preview", type: "leaf", panelId: "preview", size: 20 },
      ],
    },
  ],
};

export default function IdeWorkbench({
  collabService,
  initialLayout = WORKBENCH_LAYOUT,
}: IdeWorkbenchProps) {
  // 面板注册表：panelId → 真实组件（nodeId 契约统一）
  // 初始化项目文件（首次挂载）
  const fileStore = useFileStoreZustand.getState();
  const { initializeProject, fileContents } = fileStore;
  const initialized = useRef(false);
  if (!initialized.current && Object.keys(fileContents).length === 0) {
    initializeProject({
      "src/App.tsx": [
        "// YYC³ IDE — 多文件编辑",
        'export function App() {',
        '  return <div className="p-4 text-slate-200">Hello YYC³!</div>;',
        "}",
        "",
      ].join("\n"),
      "src/index.css": "/* 全局样式 */\n",
      "package.json": JSON.stringify({ name: "yyc3-workspace", version: "0.1.0" }, null, 2),
      "README.md": "# YYC³ Workspace\n\n多文件编辑 + 实时预览\n",
    }, "src/App.tsx");
    initialized.current = true;
  }

  const registry = useMemo(
    () =>
      ({
        code: MonacoPanel,
        files: FileExplorer,
        terminal: SandboxedTerminalPanel,
        market: AgentMarket as ComponentType<{ nodeId: string }>,
        preview: SandpackPreview as ComponentType<{ nodeId: string }>,
        collab: ({ nodeId }: { nodeId: string }) => (
          <CollabPanel nodeId={nodeId} service={collabService} />
        ),
      }) as Record<string, ComponentType<{ nodeId: string }>>,
    [collabService],
  );

  // Monaco 预热：空闲 2s 后预取分片（首屏不变）
  useMemo(() => {
    const t = setTimeout(() => void preloadMonaco(), 2_000);
    return () => clearTimeout(t);
  }, []);

  return (
    <ModelRegistryProvider>
      <PanelManagerProvider initialLayout={initialLayout}>
        <PresetToolbar />
        <div className="h-[calc(100%-2rem)]">
          <PanelRegistryProvider panels={registry}>
            <PanelShell />
          </PanelRegistryProvider>
        </div>
      </PanelManagerProvider>
    </ModelRegistryProvider>
  );
}
