/**
 * @file: services/pipeline/SystemPromptBuilder.ts
 * @description: 意图检测 + 上下文感知 System Prompt 构建 + LLM 消息组装
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-09-17
 * @updated: 2026-09-17
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: [ai,pipeline,prompt,intent-detection]
 *
 * brief: 移植自 YYC3-GitHub/ide/ai/SystemPromptBuilder.ts（v1.x）。剥离旧版
 *        SettingsBridge/AgentIntentRouter 依赖（Matrix 侧由 MCPTools / P2 AgentFleet
 *        adapter 等价提供），保留三级核心：detectIntent → buildSystemPrompt →
 *        buildChatMessages；输出格式约束与 CodeApplicator 解析器精确互锁
 */

import { compressContext, type ProjectContext } from "./ContextCollector";

// ── 意图类型 ──

export type UserIntent =
  | "generate" // 生成新代码/组件
  | "modify" // 修改现有代码
  | "fix" // 修复错误/bug
  | "explain" // 解释代码
  | "refactor" // 重构优化
  | "test" // 生成测试
  | "review" // 代码审查
  | "general"; // 通用对话

// ── 意图检测（中英双语模式，顺序即优先级）──

const INTENT_PATTERNS: Record<UserIntent, RegExp[]> = {
  test: [
    /生成.*测试|写.*测试|单元测试|test|spec|覆盖率/,
    /generate.*test|write.*test|unit test|testing/i,
  ],
  review: [/审查|检视|code review|评审/, /review|inspect|audit/i],
  // fix 优先于 explain — "代码为什么崩溃" 类请求实为修复意图
  fix: [
    /修复|修正|解决|修bug|报错|错误|异常|崩溃/,
    /fix|debug|solve|error|bug|broken|crash/i,
  ],
  explain: [
    /解释.*代码|说明.*代码|讲解.*代码|分析.*代码|代码.*是什么|代码.*怎么|代码.*为什么|代码原理/,
    /explain.*code|describe.*code|what.*code|how.*code|why.*code|understand.*code/i,
  ],
  generate: [
    /创建|生成|新建|写一个|做一个|搭建|添加|新增|实现/,
    /\bcreate|generate|build|make|add|implement|write\b/i,
  ],
  modify: [
    /修改|更改|调整|替换|改成|改为|改动/,
    /modify|change|update|alter|adjust|replace/i,
  ],
  refactor: [
    /重构|优化|性能|改善|提升|简化|整理/,
    /refactor|optimize|improve|simplify|clean|performance/i,
  ],
  general: [],
};

export function detectIntent(userMessage: string): UserIntent {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS) as [
    UserIntent,
    RegExp[],
  ][]) {
    if (intent === "general") continue;
    for (const pattern of patterns) {
      if (pattern.test(userMessage)) return intent;
    }
  }
  return "general";
}

// ── Prompt 模板 ──

const BASE_ROLE = `你是 YYC³ Family AI — 一个专业的全栈开发 AI 助手。
你精通 React 18 + TypeScript + Tailwind CSS 4 技术栈。
你的回答应该专业、精确、可直接执行。`;

/**
 * 代码输出格式约束 — 与 CodeApplicator 解析器精确互锁：
 * 首行 filepath 注释 → parseCodeBlocks 一级路径提取；完整文件内容 → 落盘零拼接
 */
const CODE_OUTPUT_FORMAT = `
## 代码输出格式要求

当你需要输出代码时，请遵循以下格式：

1. **单文件修改**: 使用标准代码块，并在首行注明文件路径：
\`\`\`tsx
// filepath: src/components/MyComponent.tsx
import React from 'react'
// ... 完整文件内容
\`\`\`

2. **多文件修改**: 每个文件使用独立的代码块，每个都注明文件路径。

3. **始终输出完整文件内容**，不要使用 "// ... 其余代码不变" 之类的省略。

4. **文件路径**必须使用项目中的实际路径（相对路径，不得以 / 开头或包含 ..）。`;

const INTENT_INSTRUCTIONS: Record<UserIntent, string> = {
  generate: `
## 任务：代码生成
- 根据用户需求生成完整的、可运行的代码
- 使用项目的现有技术栈和代码风格
- 组件使用函数式组件 + Hooks，样式使用 Tailwind CSS
- 确保类型安全（TypeScript strict mode）
- 如果需要创建新文件，给出完整的文件路径和内容`,
  modify: `
## 任务：代码修改
- 理解用户想要修改的部分
- 输出修改后的完整文件内容
- 保持文件其余部分不变
- 说明修改了哪些地方以及原因`,
  fix: `
## 任务：错误修复
- 分析错误的根因
- 提供修复方案
- 输出修复后的完整代码
- 解释为什么会出现这个错误以及如何避免`,
  explain: `
## 任务：代码解释
- 逐步解释代码的工作原理
- 解释关键概念和设计决策
- 使用清晰的语言，配合代码示例`,
  refactor: `
## 任务：代码重构
- 分析现有代码的问题
- 输出重构后的完整代码
- 说明重构带来的改进（可读性、性能、可维护性）`,
  test: `
## 任务：测试生成
- 使用 Vitest + @testing-library/react
- 覆盖主要功能和边界情况
- 使用 describe/it 结构组织测试，Mock 外部依赖
- 输出完整的测试文件`,
  review: `
## 任务：代码审查
- 检查代码质量、可读性、性能
- 指出潜在的 bug 和安全问题
- 评估类型安全性和错误处理`,
  general: `
## 任务：通用对话
- 回答用户的技术问题，提供专业建议
- 如果问题涉及代码，可以给出示例`,
};

/** 技术栈提示（与 Matrix 实际依赖一致） */
const TECH_STACK = `
## 技术栈参考
- React 18.3 + TypeScript 5.9 (strict)
- Tailwind CSS 4.3（@theme 令牌 + CSS 变量）
- Zustand 5（14 Store）
- Zod 4（运行时校验）
- Monaco 0.56 / Recharts / Lucide React
- Vitest 5 + Testing Library`;

// ── System Prompt 构建 ──

export interface SystemPromptOptions {
  maxContextTokens?: number;
  customInstructions?: string;
  /** Agent 人设注入点 — P2 AgentFleet adapter 按路由结果注入 8 家人角色 */
  agentPersona?: string;
}

export function buildSystemPrompt(
  intent: UserIntent,
  context: ProjectContext | null,
  options?: SystemPromptOptions,
): string {
  const parts: string[] = [BASE_ROLE];

  // Agent 人设（P2 舰队路由注入）
  if (options?.agentPersona) {
    parts.push(`## 智能体角色\n\n${options.agentPersona}`);
  }

  parts.push(INTENT_INSTRUCTIONS[intent]);

  // 代码输出格式（generate/modify/fix/refactor/test 需要；explain/review/general 不需要）
  if (
    intent !== "explain" &&
    intent !== "general" &&
    intent !== "review"
  ) {
    parts.push(CODE_OUTPUT_FORMAT);
  }

  // 项目上下文（Token 预算压缩）
  if (context) {
    parts.push(
      `## 项目上下文\n\n${compressContext(context, options?.maxContextTokens ?? 6000)}`,
    );
  }

  if (options?.customInstructions) {
    parts.push(`## 额外指令\n\n${options.customInstructions}`);
  }

  parts.push(TECH_STACK);
  return parts.join("\n\n");
}

// ── LLM 消息组装 ──

export interface LLMReadyMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatMessagesOptions extends SystemPromptOptions {
  maxHistoryMessages?: number;
}

/** 一步到位：用户消息 + 历史 → [system, ...history, user] 消息数组 */
export function buildChatMessages(
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  context: ProjectContext | null,
  options?: ChatMessagesOptions,
): LLMReadyMessage[] {
  const intent = detectIntent(userMessage);
  const systemPrompt = buildSystemPrompt(intent, context, options);

  const messages: LLMReadyMessage[] = [{ role: "system", content: systemPrompt }];
  const maxHistory = options?.maxHistoryMessages ?? 10;
  for (const msg of conversationHistory.slice(-maxHistory)) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}

/** Token 粗估（中英混合 ~3.5 chars/token） */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
