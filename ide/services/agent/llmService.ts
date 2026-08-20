/**
 * @file: agent/llmService.ts
 * @description: LLM Service 本地存根 — 支持运行时注入真实实现
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [service],[llm],[ai]
 *
 * brief: LLM 服务接口，支持运行时注入
 *
 * details:
 * - 提供 chatCompletionStream 和 getProviderConfig 接口
 * - 默认实现为 stub，抛出未初始化错误
 * - 支持通过 registerLLMService 注入真实实现
 * - 与外部 LLMService API 保持兼容
 *
 * dependencies: ./types
 * exports: chatCompletionStream, getProviderConfig, registerLLMService
 */

import type {
  ChatMessage,
  ChatCompletionOptions,
  ProviderConfig,
  StreamCallbacks,
} from "./types";

// ================================================================
// 服务注入机制
// ================================================================

interface LLMService {
  chatCompletionStream: (
    provider: ProviderConfig,
    modelId: string,
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: ChatCompletionOptions
  ) => void;
  getProviderConfig: (providerId: string) => ProviderConfig | null;
}

let registeredService: LLMService | null = null;

/**
 * 注册 LLM 服务实现
 * 应用启动时调用此方法注入真实的 LLM 服务
 */
export function registerLLMService(service: LLMService): void {
  registeredService = service;
}

function ensureService(): LLMService {
  if (!registeredService) {
    throw new Error(
      "[LLMService] 服务未初始化，请先调用 registerLLMService 注入实现"
    );
  }
  return registeredService;
}

// ================================================================
// 导出 API（与外部 LLMService 保持兼容）
// ================================================================

export function chatCompletionStream(
  provider: ProviderConfig,
  modelId: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: ChatCompletionOptions
): void {
  ensureService().chatCompletionStream(provider, modelId, messages, callbacks, options);
}

export function getProviderConfig(providerId: string): ProviderConfig | null {
  if (!registeredService) {
    return null;
  }
  return registeredService.getProviderConfig(providerId);
}

export default {
  chatCompletionStream,
  getProviderConfig,
  registerLLMService,
};
