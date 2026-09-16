/**
 * @file: services/pipeline/ContextCollector.ts
 * @description: 收集项目上下文供 LLM 使用 — 从 useFileStoreZustand 提取文件树/活跃文件/标签页/Git 摘要
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @updated: 2026-09-17
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: [ai,pipeline,context,file-tree]
 *
 * brief: 移植自 YYC3-GitHub/ide/ai/ContextCollector.ts（v1.x），按 Matrix 架构归位并
 *        严格类型化；作为 AIPipeline 的上游输入，Token 预算内分层压缩
 */

// ── 类型定义 ──

export interface ProjectContext {
  /** 文件树结构（缩略文本） */
  fileTree: string;
  /** 当前活跃文件 */
  activeFile: { path: string; content: string } | null;
  /** 打开的标签页路径列表（最多 5） */
  openTabs: string[];
  /** 已修改未保存的文件 */
  modifiedFiles: string[];
  /** 项目文件总数 */
  totalFiles: number;
  /** 全部文件路径 */
  allFilePaths: string[];
  /** 标签页文件内容（截断至 3000 chars） */
  selectedFilesContent: Record<string, string>;
  /** Git 状态摘要 */
  gitSummary: {
    branch: string;
    changedFiles: number;
    stagedFiles: number;
  };
}

export interface ContextCollectorInput {
  fileContents: Record<string, string>;
  activeFile: string | null;
  openTabs: { path: string; modified: boolean }[];
  gitBranch: string;
  gitChanges: { path: string; status: string; staged: boolean }[];
}

// ── 压缩参数（Token 预算）──

const TAB_FILES_LIMIT = 5;
const TAB_FILE_CHAR_LIMIT = 3000;
const ACTIVE_FILE_CHAR_LIMIT = 8000;

// ── 收集项目上下文 ──

export function collectContext(input: ContextCollectorInput): ProjectContext {
  const { fileContents, activeFile, openTabs, gitBranch, gitChanges } = input;

  const allPaths = Object.keys(fileContents).sort();
  const modifiedFiles = openTabs.filter((t) => t.modified).map((t) => t.path);
  const fileTree = buildFileTreeText(allPaths);

  const activeFileCtx =
    activeFile && fileContents[activeFile]
      ? { path: activeFile, content: fileContents[activeFile] }
      : null;

  // 标签页内容（最多 5 个，大文件截断，避免 token 爆炸）
  const selectedFilesContent: Record<string, string> = {};
  const tabPaths = openTabs.map((t) => t.path).slice(0, TAB_FILES_LIMIT);
  for (const p of tabPaths) {
    const content = fileContents[p];
    if (content && p !== activeFile) {
      selectedFilesContent[p] =
        content.length > TAB_FILE_CHAR_LIMIT
          ? `${content.slice(0, TAB_FILE_CHAR_LIMIT)}\n// ... (truncated, ${content.length} chars total)`
          : content;
    }
  }

  return {
    fileTree,
    activeFile: activeFileCtx,
    openTabs: tabPaths,
    modifiedFiles,
    totalFiles: allPaths.length,
    allFilePaths: allPaths,
    selectedFilesContent,
    gitSummary: {
      branch: gitBranch,
      changedFiles: gitChanges.length,
      stagedFiles: gitChanges.filter((c) => c.staged).length,
    },
  };
}

// ── 文件树文本构建 ──

function buildFileTreeText(paths: string[]): string {
  if (paths.length === 0) return "(empty project)";

  const tree = new Map<string, string[]>();
  for (const p of paths) {
    const parts = p.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    if (!tree.has(dir)) tree.set(dir, []);
    tree.get(dir)!.push(parts[parts.length - 1]);
  }

  const lines: string[] = [];
  for (const dir of [...tree.keys()].sort()) {
    lines.push(`📁 ${dir}/`);
    for (const f of tree.get(dir)!.sort()) {
      lines.push(`   ${getFileIcon(f)} ${f}`);
    }
  }
  return lines.join("\n");
}

function getFileIcon(filename: string): string {
  if (filename.endsWith(".tsx") || filename.endsWith(".jsx")) return "⚛️";
  if (filename.endsWith(".css") || filename.endsWith(".scss")) return "🎨";
  if (filename.endsWith(".json")) return "📋";
  if (filename.endsWith(".md")) return "📝";
  if (filename.endsWith(".html")) return "🌐";
  return "📄";
}

// ── Token 估算与压缩 ──

/** 粗略估算：中英混合 ~3.5 chars/token */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/**
 * 按优先级压缩上下文至 Token 预算内：
 * 文件树（必含）→ 活跃文件（8000 chars 上限）→ Git 状态 → 标签页清单 → 相关文件（余量 > 30% 时）
 */
export function compressContext(ctx: ProjectContext, maxTokens = 8000): string {
  const parts: string[] = [];

  // 1. 文件树（始终包含）
  parts.push(`## 项目文件结构\n\`\`\`\n${ctx.fileTree}\n\`\`\``);

  // 2. 活跃文件（优先级最高）
  if (ctx.activeFile) {
    const truncated =
      ctx.activeFile.content.length > ACTIVE_FILE_CHAR_LIMIT
        ? `${ctx.activeFile.content.slice(0, ACTIVE_FILE_CHAR_LIMIT)}\n// ... (truncated, ${ctx.activeFile.content.length} chars total)`
        : ctx.activeFile.content;
    const ext = ctx.activeFile.path.split(".").pop() || "";
    const langMap: Record<string, string> = {
      tsx: "tsx",
      ts: "typescript",
      jsx: "jsx",
      js: "javascript",
      css: "css",
      json: "json",
      md: "markdown",
      html: "html",
    };
    parts.push(
      `## 当前编辑文件: ${ctx.activeFile.path}\n\`\`\`${langMap[ext] || ext}\n${truncated}\n\`\`\``,
    );
  }

  // 3. Git 状态
  parts.push(
    `## Git 状态\n- 分支: ${ctx.gitSummary.branch}\n- 已修改: ${ctx.gitSummary.changedFiles} 个文件\n- 已暂存: ${ctx.gitSummary.stagedFiles} 个文件`,
  );

  // 4. 打开标签（清单）
  if (ctx.openTabs.length > 0) {
    parts.push(`## 打开的文件\n${ctx.openTabs.map((t) => `- ${t}`).join("\n")}`);
  }

  // 5. 相关文件（预算余量 > 30% 时逐个附加）
  let currentTokens = estimateTokens(parts.join("\n\n"));
  for (const [path, content] of Object.entries(ctx.selectedFilesContent)) {
    if (currentTokens >= maxTokens * 0.7) break;
    const addition = `## 相关文件: ${path}\n\`\`\`\n${content}\n\`\`\``;
    const addTokens = estimateTokens(addition);
    if (currentTokens + addTokens < maxTokens) {
      parts.push(addition);
      currentTokens += addTokens;
    }
  }

  return parts.join("\n\n");
}
