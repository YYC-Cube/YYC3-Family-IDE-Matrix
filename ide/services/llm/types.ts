/**
 * @file: types.ts
 * @description: LLM 服务层共享类型 — Provider/模型/消息/连通性/意图/降级
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.1.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: llm,types,providers,chat
 *
 * brief: 回迁时从 LLMService.ts / AIDegradationService.ts 抽取的公共类型层
 *
 * details:
 * - LLMService ↔ AIDegradationService 存在运行时值级循环依赖（双方仅在函数体内
 *   互调，ESM 活绑定可安全工作）；共享类型集中到本文件后，环面缩小为纯函数值
 * - LLMService.ts 与 AIDegradationService.ts 均按原 API 兼容地 re-export 这些类型
 */

// ── Provider ──

export type ProviderId = "zai-plan" | "ollama";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  nameEn: string;
  baseUrl: string;
  authType: "none" | "bearer";
  apiKey?: string;
  models: ProviderModel[];
  isLocal: boolean;
  detected: boolean;
  description: string;
  docsUrl: string;
}

export interface ProviderModel {
  id: string; // API model id
  name: string; // 显示名
  type: "llm" | "code" | "vision" | "embedding";
  maxTokens: number;
  contextWindow?: number;
  description?: string;
}

// ── Chat ──

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

// ── 连通性测试 ──

export interface ConnectivityTestResult {
  success: boolean;
  latencyMs: number;
  modelId: string;
  providerId: ProviderId;
  reply?: string; // first few chars of the model's reply
  error?: string; // human-readable error reason
  errorCode?: string; // HTTP status or error type
  timestamp: number;
}

// ── AI 语义意图分类 ──

export interface AIIntentResult {
  mode: "designer" | "ai-workspace";
  confidence: number;
  category: string;
  summary: string;
  suggestion: string;
}

// ── 降级（原定义于 AIDegradationService，前移至共享层）──

export type DegradationLevel = "optimal" | "degraded" | "minimal" | "unavailable";
