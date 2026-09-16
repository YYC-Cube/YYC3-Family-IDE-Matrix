/**
 * @file: services/pipeline/AIPipeline.ts
 * @description: 端到端 AI 代码流水线编排 — 意图检测 → 上下文收集 → Prompt 构建 → LLM 调用 → 代码落盘 → diff
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @updated: 2026-09-17
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: [ai,pipeline,orchestration,llm,file-store]
 *
 * brief: 移植自 YYC3-GitHub/ide/ai/AIPipeline.ts 并按 Matrix 架构重写编排层：
 *        LLM 调用走 services/llm/proxyAdapter（代理优先/直连回退），落盘经
 *        useFileStoreZustand 适配器。runPipeline 一步完成 AI 回复 → 落盘 → diff 闭环
 */

import { logger } from "../../lib/logger";
import { useFileStoreZustand } from "../../stores/useFileStoreZustand";
import { findAvailableProvider } from "../llm/LLMService";
import { smartChatCompletion } from "../llm/proxyAdapter";
import type { ChatMessage } from "../llm/types";
import {
  applyCodeToFiles,
  generatePlanDiff,
  parseCodeBlocks,
  type ApplyResult,
  type CodeApplicationPlan,
  type DiffLine,
} from "./CodeApplicator";
import {
  collectContext,
  type ContextCollectorInput,
  type ProjectContext,
} from "./ContextCollector";
import {
  buildSystemPrompt,
  detectIntent,
  type SystemPromptOptions,
  type UserIntent,
} from "./SystemPromptBuilder";

// ── Pipeline 类型 ──

export interface PipelineInput {
  /** 用户当前消息 */
  userMessage: string;
  /** 对话历史（不含当前消息） */
  conversationHistory?: { role: "user" | "assistant"; content: string }[];
  /** Prompt 构建选项 */
  promptOptions?: SystemPromptOptions;
  /** 上下文 Token 预算 */
  maxContextTokens?: number;
}

/** LLM 回复解析/落盘前的预览 */
export interface PipelinePlanPreview {
  intent: UserIntent;
  plan: CodeApplicationPlan;
  /** 逐文件 diff（未落盘） */
  diffs: Record<string, DiffLine[]>;
}

export interface PipelineResult {
  /** LLM 原始回复 */
  reply: string;
  /** 检测到的意图 */
  intent: UserIntent;
  /** 解析出的代码块计划（可为空 — 纯对话场景） */
  plan: CodeApplicationPlan | null;
  /** 落盘结果（无代码块时为 null） */
  applied: ApplyResult | null;
  /** 落盘后 diff */
  diffs: Record<string, DiffLine[]>;
}

// ── 上下文收集（FileStore 驱动）──

export function collectPipelineContext(
  input?: Partial<ContextCollectorInput>,
): ProjectContext {
  const store = useFileStoreZustand.getState();
  return collectContext({
    fileContents: input?.fileContents ?? store.fileContents,
    activeFile: input?.activeFile ?? store.currentFilePath,
    openTabs: input?.openTabs ?? store.recentFiles.map((path) => ({ path, modified: false })),
    gitBranch: input?.gitBranch ?? "main",
    gitChanges: input?.gitChanges ?? [],
  });
}

// ── LLM 调用（代理优先/直连回退，由 proxyAdapter 决策）──

async function callLLM(messages: ChatMessage[]): Promise<string> {
  const providerInfo = findAvailableProvider();
  if (!providerInfo) {
    throw new Error("无可用 LLM Provider — 请在模型设置中配置并探测供应商");
  }
  const { config, modelId } = providerInfo;
  const reply = await smartChatCompletion(config, modelId, messages, {
    temperature: 0.2,
  });
  return typeof reply === "string" ? reply : JSON.stringify(reply);
}

// ── 单步 API ──

/**
 * 仅预览：LLM 回复中的代码块解析 + diff，不落盘。
 * 供 UI 先展示「将要修改什么」再由用户确认。
 *
 * @param userMessage 触发本次回复的用户消息 — 意图检测应以用户输入为准
 */
export function previewPlanFromReply(
  reply: string,
  existingFiles?: Record<string, string>,
  userMessage?: string,
): PipelinePlanPreview {
  const intent = userMessage ? detectIntent(userMessage) : "general";
  const files = existingFiles ?? useFileStoreZustand.getState().fileContents;
  const plan = parseCodeBlocks(reply, files);
  return { intent, plan, diffs: generatePlanDiff(plan, files) };
}

/**
 * 端到端流水线：用户消息 → LLM → 解析代码块 → 落盘 FileStore → diff。
 *
 * @returns PipelineResult — plan/applied 为 null 表示纯对话（无代码变更）
 */
export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const context = collectPipelineContext();
  const intent = detectIntent(input.userMessage);
  const systemPrompt = buildSystemPrompt(intent, context, {
    ...input.promptOptions,
    maxContextTokens: input.maxContextTokens,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(input.conversationHistory ?? []).slice(-10),
    { role: "user", content: input.userMessage },
  ];

  const reply = await callLLM(messages);
  logger.info("[AIPipeline] intent:", intent, "reply length:", reply.length);

  const files = useFileStoreZustand.getState().fileContents;
  const plan = parseCodeBlocks(reply, files);

  if (plan.blocks.length === 0) {
    return { reply, intent, plan: null, applied: null, diffs: {} };
  }

  const diffs = generatePlanDiff(plan, files);
  const store = useFileStoreZustand.getState();
  const applied = applyCodeToFiles(plan, {
    updateFile: store.updateFile,
    // FileStore 无独立 createFile — updateFile 即 upsert 语义
    createFile: store.updateFile,
  });

  logger.warn(
    `[AIPipeline] applied ${applied.appliedFiles.length} files, errors: ${applied.errors.length}`,
  );
  return { reply, intent, plan, applied, diffs };
}
