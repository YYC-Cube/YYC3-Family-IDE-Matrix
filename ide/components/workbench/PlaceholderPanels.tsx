/**
 * @file: PlaceholderPanels.tsx
 * @description: 面板注册表占位组件 — git/knowledge/rag/ops 四类面板的统一待实现槽位
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @updated: 2026-09-17
 * @status: active
 * @tags: [panel-host],[placeholder],[registry]
 *
 * brief: 使 LAYOUT_PRESETS / PANEL_TITLES 中已声明的面板 id 不再显示
 *        「未注册」，以统一的规划中占位视图呈现，保留完整面板交互框
 */

import { GitBranch, BookOpen, Search, ServerCog } from "lucide-react";
import type { ComponentType } from "react";

function Placeholder({
  nodeId,
  title,
  description,
  icon: Icon,
  accent,
}: {
  nodeId: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-(--ide-bg) px-4 text-center">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[0.78rem] text-slate-300">{title}</span>
      <p className="max-w-56 text-[0.62rem] leading-relaxed text-slate-600">{description}</p>
      <span className="mt-1 rounded border border-(--ide-border-faint) px-1.5 py-0.5 text-[0.55rem] text-slate-700">
        面板槽 {nodeId} · 规划中
      </span>
    </div>
  );
}

export function GitPanel({ nodeId }: { nodeId: string }) {
  return (
    <Placeholder
      nodeId={nodeId}
      title="Git 面板"
      description="分支管理、暂存区与提交历史将在此呈现"
      icon={GitBranch}
      accent="bg-orange-500/10 text-orange-400"
    />
  );
}

export function KnowledgePanel({ nodeId }: { nodeId: string }) {
  return (
    <Placeholder
      nodeId={nodeId}
      title="知识库"
      description="项目知识、代码模式与偏好记忆的统一视图"
      icon={BookOpen}
      accent="bg-violet-500/10 text-violet-400"
    />
  );
}

export function RagPanel({ nodeId }: { nodeId: string }) {
  return (
    <Placeholder
      nodeId={nodeId}
      title="RAG 检索"
      description="语义检索增强生成，对接向量知识源"
      icon={Search}
      accent="bg-sky-500/10 text-sky-400"
    />
  );
}

export function OpsPanel({ nodeId }: { nodeId: string }) {
  return (
    <Placeholder
      nodeId={nodeId}
      title="运维中枢"
      description="治理中枢指标、Agent 舰队健康与部署状态"
      icon={ServerCog}
      accent="bg-emerald-500/10 text-emerald-400"
    />
  );
}
