/**
 * @file: SandpackPreview.tsx
 * @description: Sandpack 实时预览 — 多文件编辑 + 热更新（Phase 3 P3-2）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-28
 * @status: active
 * @tags: [sandpack,preview,phase-3]
 *
 * brief: 从 FileStore 读取项目文件 → Sandpack 实时渲染
 *        支持 React/TS 项目模板，文件变更即时热更新
 */

import { useMemo } from "react";
import {
  SandpackProvider,
  SandpackPreview as SandpackPreviewCore,
  SandpackFileExplorer,
} from "@codesandbox/sandpack-react";
import { Eye } from "lucide-react";
import { PanelHeader } from "./components/panel-host";
import { useFileStoreZustand } from "./stores/useFileStoreZustand";

// ── 文件路径转换 ──

function toSandpackFiles(fileContents: Record<string, string>): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(fileContents)) {
    const sandpackPath = path.startsWith("/") ? path : `/${path}`;
    files[sandpackPath] = content;
  }
  return files;
}

// ── 入口检测 ──

function detectTemplate(files: Record<string, string>): "react-ts" | "static" {
  const pkg = files["/package.json"] ?? "";
  const hasReact = pkg.includes("react") ||
    Object.values(files).some((c) => c.includes("react") || c.includes("ReactDOM"));
  return hasReact ? "react-ts" : "static";
}

// ── 组件 ──

export default function SandpackPreview({ nodeId }: { nodeId: string }) {
  const fileContents = useFileStoreZustand.getState().fileContents;
  const files = useMemo(() => toSandpackFiles(fileContents), [fileContents]);
  const template = useMemo(() => detectTemplate(files), [files]);

  if (Object.keys(files).length === 0) {
    return (
      <div className="panel-host-root flex size-full flex-col bg-[var(--ide-bg)]">
        <PanelHeader
          nodeId={nodeId}
          panelId="preview"
          title="预览"
          icon={<Eye className="h-3 w-3 text-emerald-400/70" />}
        />
        <div className="flex flex-1 items-center justify-center text-[0.7rem] text-slate-600">
          <div className="flex flex-col items-center gap-2">
            <Eye className="h-8 w-8 text-slate-700" />
            <span>从文件浏览器创建文件开始预览</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-host-root flex size-full flex-col bg-[var(--ide-bg)]">
      <PanelHeader
        nodeId={nodeId}
        panelId="preview"
        title="预览"
        icon={<Eye className="h-3 w-3 text-emerald-400/70" />}
      >
        <span className="text-[0.55rem] text-slate-600">
          {Object.keys(files).length} 文件 · {template === "react-ts" ? "React" : "静态"}
        </span>
      </PanelHeader>
      <div className="min-h-0 flex-1">
        <SandpackProvider
          template={template}
          files={files}
          theme="dark"
          options={{
            autorun: true,
            recompileMode: "delayed",
            recompileDelay: 500,
          }}
        >
          <div className="flex size-full">
            <div className="hidden w-40 border-r border-[var(--ide-border-faint)] md:block">
              <SandpackFileExplorer style={{ height: "100%", fontSize: "0.65rem" }} />
            </div>
            <div className="min-w-0 flex-1">
              <SandpackPreviewCore
                showNavigator={false}
                showOpenInCodeSandbox={false}
                showRefreshButton={true}
                style={{ height: "100%" }}
              />
            </div>
          </div>
        </SandpackProvider>
      </div>
    </div>
  );
}
