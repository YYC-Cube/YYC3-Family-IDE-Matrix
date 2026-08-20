/**
 * @file: index.ts
 * @description: LLM 调用服务层统一出口 — Provider 配置 / Chat / 流式 / 降级 / 限流
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.1.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [llm],[service],[index],[barrel],[re-export]
 *
 * brief: LLM 能力域的「单一入口」（1.5 批回迁：解锁 Agent 编排批次的关键依赖）
 *
 * usage:
 * ```
 * import {
 *   getProviderConfigs, chatCompletion, chatCompletionStream,
 *   resilientChatCompletion, getAIDegradationService,
 * } from "@/services/llm";
 *
 * const reply = await resilientChatCompletion(
 *   [{ role: "user", content: "你好" }],
 * );
 * ```
 *
 * dependencies: ../logger, ./providers, ./RateLimiter, ./AIDegradationService
 */

// ── 核心调用层（LLMService 同时 re-export 全部共享类型）──
export {
  convertToProviderConfig,
  getProviderConfigs,
  getProviderConfig,
  getApiKey,
  setApiKey,
  hasApiKey,
  initializeApiKeysFromEnv,
  detectOllama,
  testModelConnectivity,
  getChatEndpoint,
  buildHeaders,
  chatCompletion,
  chatCompletionStream,
  extractCodeBlock,
  resilientChatCompletion,
  resilientChatCompletionStream,
  getDegradationState,
  startDegradationHealthChecks,
  stopDegradationHealthChecks,
  analyzeIntentAI,
  findAvailableProvider,
} from "./LLMService";

export type {
  ProviderId,
  ProviderConfig,
  ProviderModel,
  ChatMessage,
  StreamCallbacks,
  ConnectivityTestResult,
  AIIntentResult,
  ResilientChatOptions,
} from "./LLMService";

// ── 降级引擎 ──
export {
  AIDegradationService,
  getAIDegradationService,
  configureAIDegradationService,
  destroyAIDegradationService,
} from "./AIDegradationService";

export type {
  DegradationLevel,
  ProviderHealth,
  DegradationState,
  DegradationConfig,
} from "./AIDegradationService";

// ── 限流 / 熔断 ──
export {
  TokenBucketLimiter,
  SlidingWindowLimiter,
  CircuitBreaker,
  RateLimiter,
  rateLimit,
  getGlobalRateLimiter,
  configureGlobalRateLimiter,
  LLMRateLimiter,
  llmRateLimiter,
} from "./RateLimiter";

export type {
  LimiterType,
  CircuitState,
  RateLimiterConfig,
  CircuitBreakerConfig,
  RateLimitResult,
  LimiterStats,
} from "./RateLimiter";

// ── Provider 元数据（唯一真相源）──
export {
  BUILTIN_PROVIDERS,
  OLLAMA_PROVIDER,
  ZAI_PLAN_PROVIDER,
} from "./providers";

export type { ModelDef, ProviderDef } from "./providers";
