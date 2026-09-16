/**
 * @file: services/pipeline/CodeApplicator.ts
 * @description: 解析 LLM 响应中的代码块并应用至 FileStore — 多文件/新建/更新/diff 预览/Zod 路径校验
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-09-17
 * @updated: 2026-09-17
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: [ai,pipeline,code-applicator,diff,file-system]
 *
 * brief: 移植自 YYC3-GitHub/ide/ai/CodeApplicator.ts（v1.x，@ts-nocheck），按 Matrix
 *        架构严格类型化，路径合法性以 Zod 4 校验（防越界写入）；applyCodeToFiles
 *        直连 useFileStoreZustand 适配器，AI 回复 → 落盘 → diff 全链路闭环
 */

import { z } from "zod";

// ── 类型定义 ──

export interface ParsedCodeBlock {
  /** 目标文件路径（项目相对） */
  filepath: string;
  /** 语言标识（tsx/ts/css/json…） */
  language: string;
  /** 完整文件内容 */
  content: string;
  /** 是否新文件 */
  isNew: boolean;
}

export interface CodeApplicationPlan {
  blocks: ParsedCodeBlock[];
  /** 变更摘要（中文） */
  summary: string;
  fileCount: number;
  newFileCount: number;
  modifiedFileCount: number;
}

export interface ApplyResult {
  success: boolean;
  appliedFiles: string[];
  errors: string[];
}

/** 单行 diff */
export interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
  lineNumber: number;
}

// ── 路径安全校验（Zod 4）──
// 防御：绝对路径 / ../ 越界 / 反斜杠 / 非法字符

const SafeFilepath = z
  .string()
  .min(1)
  .max(512)
  .refine((p) => !p.startsWith("/") && !p.includes("..") && !p.includes("\\"), {
    message: "路径必须为项目内相对路径",
  })
  .refine((p) => /^[\w./@\-()[\] ]+$/.test(p), {
    message: "路径包含非法字符",
  });

export function isSafeFilepath(path: string): boolean {
  return SafeFilepath.safeParse(path).success;
}

// ── 解析 LLM 响应中的代码块 ──

const CODE_BLOCK_REGEX = /```(\w+)?\s*\n([\s\S]*?)```/g;
const FILEPATH_REGEX = /^\/\/\s*filepath:\s*(.+?)$/m;
const FILEPATH_ALT_REGEX = /^\/\*\s*filepath:\s*(.+?)\s*\*\/$/m;
const FILEPATH_COMMENT_REGEX =
  /^(?:\/\/|#|\/\*)\s*(?:file(?:path)?|File|FILE):\s*(.+?)(?:\s*\*\/)?$/m;

/** 非代码块语言（shell/输出示例），跳过不落盘 */
const NON_CODE_LANGS = new Set([
  "bash",
  "sh",
  "shell",
  "cmd",
  "powershell",
  "console",
  "terminal",
]);

export function parseCodeBlocks(
  llmResponse: string,
  existingFiles: Record<string, string>,
): CodeApplicationPlan {
  const blocks: ParsedCodeBlock[] = [];
  CODE_BLOCK_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CODE_BLOCK_REGEX.exec(llmResponse)) !== null) {
    const language = match[1] || "plaintext";
    const rawContent = match[2].trim();

    if (NON_CODE_LANGS.has(language)) continue;

    // 三级路径解析：代码内注释 → 上文语境 → 内容推断
    let filepath = extractFilepath(rawContent);
    if (!filepath) {
      const precedingText = llmResponse.slice(Math.max(0, match.index - 200), match.index);
      filepath = extractFilepathFromContext(precedingText);
    }
    if (!filepath) filepath = inferFilepath(rawContent, language, existingFiles);

    // 路径不合法（缺失/越界/非法字符）一律跳过
    if (!filepath || !isSafeFilepath(filepath)) continue;

    const cleanedContent = cleanFileContent(rawContent);
    blocks.push({
      filepath,
      language,
      content: cleanedContent,
      isNew: !(filepath in existingFiles),
    });
  }

  // 同路径多块取最后（LLM 迭代修正语义）
  const deduped = new Map<string, ParsedCodeBlock>();
  for (const block of blocks) deduped.set(block.filepath, block);
  const finalBlocks = [...deduped.values()];

  return {
    blocks: finalBlocks,
    summary: buildSummary(finalBlocks),
    fileCount: finalBlocks.length,
    newFileCount: finalBlocks.filter((b) => b.isNew).length,
    modifiedFileCount: finalBlocks.filter((b) => !b.isNew).length,
  };
}

// ── 三级路径解析 ──

function extractFilepath(content: string): string | null {
  const firstLine = content.split("\n")[0].trim();
  for (const regex of [FILEPATH_REGEX, FILEPATH_ALT_REGEX, FILEPATH_COMMENT_REGEX]) {
    const m = firstLine.match(regex);
    if (m) return normalizePath(m[1].trim());
  }
  return null;
}

function extractFilepathFromContext(text: string): string | null {
  const patterns = [
    /[`"]([^`"]+\.(?:tsx?|jsx?|css|json|html|md))[`"]/,
    /(?:文件|file)[:\s]+[`"]?([^\s`"]+\.(?:tsx?|jsx?|css|json|html|md))[`"]?/i,
    /(?:创建|修改|更新|create|modify|update)\s+[`"]?([^\s`"]+\.(?:tsx?|jsx?|css|json|html|md))[`"]?/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return normalizePath(m[1]);
  }
  return null;
}

function inferFilepath(
  content: string,
  language: string,
  existingFiles: Record<string, string>,
): string | null {
  const exportMatch = content.match(/export\s+(?:default\s+)?function\s+(\w+)/);
  const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+)/);
  const componentName = exportMatch?.[1] || classMatch?.[1];
  if (!componentName) return null;

  const ext = language === "tsx" || language === "jsx" ? ".tsx" : ".ts";

  // 已存在同名组件 → 命中现有文件
  for (const path of Object.keys(existingFiles)) {
    const fileName = path.split("/").pop()?.replace(/\.\w+$/, "");
    if (fileName === componentName) return path;
  }
  return `src/components/${componentName}${ext}`;
}

function cleanFileContent(content: string): string {
  const lines = content.split("\n");
  if (lines.length > 0) {
    const first = lines[0].trim();
    if (
      FILEPATH_REGEX.test(first) ||
      FILEPATH_ALT_REGEX.test(first) ||
      FILEPATH_COMMENT_REGEX.test(first)
    ) {
      lines.shift();
      if (lines.length > 0 && lines[0].trim() === "") lines.shift();
    }
  }
  return lines.join("\n");
}

function normalizePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/^\//, "");
}

function buildSummary(blocks: ParsedCodeBlock[]): string {
  if (blocks.length === 0) return "无代码变更";
  const parts: string[] = [];
  const newFiles = blocks.filter((b) => b.isNew);
  const modFiles = blocks.filter((b) => !b.isNew);
  if (newFiles.length > 0) {
    parts.push(`新建 ${newFiles.length} 个文件: ${newFiles.map((b) => b.filepath).join(", ")}`);
  }
  if (modFiles.length > 0) {
    parts.push(`修改 ${modFiles.length} 个文件: ${modFiles.map((b) => b.filepath).join(", ")}`);
  }
  return parts.join("；");
}

// ── 应用代码到 FileStore ──

export interface FileStoreAdapter {
  updateFile: (path: string, content: string) => void;
  createFile: (path: string, content: string) => void;
}

/**
 * 将解析计划落盘。回调式适配器解耦 Store 实现（useFileStoreZustand / 未来 IPC 后端）。
 * 每个块独立 try/catch：单文件失败不阻断其余文件。
 */
export function applyCodeToFiles(
  plan: CodeApplicationPlan,
  adapter: FileStoreAdapter,
): ApplyResult {
  const appliedFiles: string[] = [];
  const errors: string[] = [];

  for (const block of plan.blocks) {
    try {
      if (!isSafeFilepath(block.filepath)) {
        errors.push(`Blocked unsafe path: ${block.filepath}`);
        continue;
      }
      if (block.isNew) {
        adapter.createFile(block.filepath, block.content);
      } else {
        adapter.updateFile(block.filepath, block.content);
      }
      appliedFiles.push(block.filepath);
    } catch (err) {
      errors.push(
        `Failed to apply ${block.filepath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { success: errors.length === 0, appliedFiles, errors };
}

// ── Diff 预览 ──

/**
 * 逐行 diff（非 LCS，预览足够）：新建文件全行 added；同位比较 unchanged/removed+added
 */
export function generateSimpleDiff(
  oldContent: string | undefined,
  newContent: string,
): DiffLine[] {
  if (oldContent === undefined) {
    return newContent.split("\n").map((line, i) => ({
      type: "added" as const,
      content: line,
      lineNumber: i + 1,
    }));
  }

  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const result: DiffLine[] = [];
  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;
    if (oldLine === newLine) {
      result.push({ type: "unchanged", content: newLine!, lineNumber: i + 1 });
    } else {
      if (oldLine !== undefined) {
        result.push({ type: "removed", content: oldLine, lineNumber: i + 1 });
      }
      if (newLine !== undefined) {
        result.push({ type: "added", content: newLine, lineNumber: i + 1 });
      }
    }
  }
  return result;
}

/** 为解析计划生成逐文件 diff 预览（不落盘） */
export function generatePlanDiff(
  plan: CodeApplicationPlan,
  existingFiles: Record<string, string>,
): Record<string, DiffLine[]> {
  const diffs: Record<string, DiffLine[]> = {};
  for (const block of plan.blocks) {
    diffs[block.filepath] = generateSimpleDiff(existingFiles[block.filepath], block.content);
  }
  return diffs;
}
