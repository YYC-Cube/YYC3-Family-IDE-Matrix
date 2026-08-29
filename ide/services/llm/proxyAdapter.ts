/**
 * @file: services/llm/proxyAdapter.ts
 * @description: LLM 代理适配层 — Phase 2 P2-1 密钥服务端代理（审计 R2 阶段二）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-28
 * @updated: 2026-08-28
 * @status: active
 * @tags: [llm,proxy,security,key-management]
 *
 * brief: 代理启用时，LLM 请求经 ProxyService 转发而非浏览器直发 Bearer——
 *        API Key 仅存服务端，浏览器零密钥暴露
 *
 * usage:
 * ```ts
 * import { smartChatCompletion } from "@/services/llm/proxyAdapter";
 *
 * // 代理已配置 → 经 proxyFetch（密钥在服务端注入）
 * // 代理未启用 → 回退 LLMService 直发（密钥在 localStorage，开发模式）
 * const reply = await smartChatCompletion(provider, modelId, messages);
 * ```
 */

import { logger } from "../../lib/logger";
import {
  loadProxyConfig,
  saveProxyConfig,
  proxyFetch,
  checkProxyHealth,
  type ProxyConfig,
} from "../../ProxyService";
import {
  chatCompletion,
  chatCompletionStream,
  getChatEndpoint,
  buildHeaders,
  getApiKey,
  type ProviderConfig,
  type ChatMessage,
  type StreamCallbacks,
} from "./LLMService";

// ── 代理状态管理 ──

let cachedConfig: ProxyConfig | null = null;
let healthCache: { healthy: boolean; checkedAt: number } = {
  healthy: false,
  checkedAt: 0,
};
const HEALTH_CACHE_TTL = 60_000; // 1 分钟

/** 获取代理配置（缓存 + localStorage 持久化） */
export function getProxyConfig(): ProxyConfig {
  if (!cachedConfig) {
    cachedConfig = loadProxyConfig();
  }
  return cachedConfig;
}

/** 更新代理配置 */
export function updateProxyConfig(partial: Partial<ProxyConfig>): ProxyConfig {
  cachedConfig = saveProxyConfig(partial);
  healthCache.checkedAt = 0; // 置零健康缓存
  return cachedConfig;
}

/** 代理是否启用且已配置 */
export function isProxyEnabled(): boolean {
  const config = getProxyConfig();
  return config.enabled && config.baseUrl.trim().length > 0;
}

/** 代理健康检查（1 分钟缓存） */
export async function isProxyHealthy(): Promise<boolean> {
  if (!isProxyEnabled()) return false;

  const now = Date.now();
  if (now - healthCache.checkedAt < HEALTH_CACHE_TTL) {
    return healthCache.healthy;
  }

  const config = getProxyConfig();
  const result = await checkProxyHealth(config.baseUrl);
  healthCache = { healthy: result.healthy, checkedAt: now };

  if (!result.healthy) {
    logger.warn(`[ProxyAdapter] 代理不健康: ${result.error}`);
  }
  return result.healthy;
}

// ── 智能调用（代理优先 → 直发回退）──

/**
 * 智能非流式调用：
 * 1. 代理启用且健康 → proxyFetch（密钥在服务端，浏览器零暴露）
 * 2. 代理不可用 → 回退 LLMService 直发（密钥在 localStorage，仅开发模式安全）
 */
export async function smartChatCompletion(
  provider: ProviderConfig,
  modelId: string,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  if (isProxyEnabled()) {
    try {
      return await proxyChatCompletion(provider, modelId, messages, options);
    } catch (error) {
      logger.warn("[ProxyAdapter] 代理调用失败，回退直发:", error);
    }
  }

  // 回退：直发（密钥在浏览器——仅开发模式可接受）
  return chatCompletion(provider, modelId, messages, options);
}

/**
 * 智能流式调用：
 * 1. 代理启用且健康 → proxyFetch 流式转发
 * 2. 代理不可用 → 回退 LLMService 直发流式
 */
export async function smartChatCompletionStream(
  provider: ProviderConfig,
  modelId: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal },
): Promise<void> {
  if (isProxyEnabled()) {
    try {
      return await proxyChatCompletionStream(provider, modelId, messages, callbacks, options);
    } catch (error) {
      logger.warn("[ProxyAdapter] 代理流式失败，回退直发:", error);
      // 流式回退：通知调用方后走直发
      if (callbacks.onError) {
        callbacks.onError("代理流式不可用，已回退直发");
      }
    }
  }

  return chatCompletionStream(provider, modelId, messages, callbacks, options);
}

// ── 代理转发实现 ──

async function proxyChatCompletion(
  provider: ProviderConfig,
  modelId: string,
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const config = getProxyConfig();
  const endpoint = getChatEndpoint(provider);

  const response = await proxyFetch(config, {
    provider: provider.id,
    endpoint: endpoint.startsWith("/") ? endpoint : `/${endpoint}`,
    method: "POST",
    body: {
      model: modelId,
      messages,
      temperature: options?.temperature ?? 0.7,
      stream: false,
      ...(options?.maxTokens && { max_tokens: options.maxTokens }),
    },
    stream: false,
  });

  if (!response.ok) {
    throw new Error(`代理返回 ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  // Ollama / OpenAI 兼容格式
  return data.choices?.[0]?.message?.content ?? data.message?.content ?? "";
}

async function proxyChatCompletionStream(
  provider: ProviderConfig,
  modelId: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: { temperature?: number; maxTokens?: number; signal?: AbortSignal },
): Promise<void> {
  const config = getProxyConfig();
  const endpoint = getChatEndpoint(provider);

  const response = await proxyFetch(config, {
    provider: provider.id,
    endpoint: endpoint.startsWith("/") ? endpoint : `/${endpoint}`,
    method: "POST",
    body: {
      model: modelId,
      messages,
      temperature: options?.temperature ?? 0.7,
      stream: true,
      ...(options?.maxTokens && { max_tokens: options.maxTokens }),
    },
    stream: true,
  });

  if (!response.ok) {
    throw new Error(`代理返回 ${response.status}: ${response.statusText}`);
  }

  // SSE 解析（与 LLMService.chatCompletionStream 相同协议）
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("无法获取代理响应流");
  }

  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === ":" || trimmed.startsWith(": ")) continue;

        if (provider.id === "ollama") {
          // Ollama JSON-per-line
          try {
            const json = JSON.parse(trimmed);
            const token = json.message?.content || "";
            if (token) {
              fullText += token;
              callbacks.onToken(token);
            }
            if (json.done) {
              callbacks.onDone(fullText);
              return;
            }
          } catch { /* skip */ }
          continue;
        }

        // 标准 SSE
        if (!trimmed.startsWith("data:")) continue;
        const dataStr = trimmed.slice(5).trim();
        if (dataStr === "[DONE]") {
          callbacks.onDone(fullText);
          return;
        }

        try {
          const json = JSON.parse(dataStr);
          const token = json.choices?.[0]?.delta?.content || "";
          if (token) {
            fullText += token;
            callbacks.onToken(token);
          }
        } catch { /* skip */ }
      }
    }

    if (fullText) callbacks.onDone(fullText);
  } finally {
    reader.releaseLock();
  }
}

// ── 代理服务器 Node.js 参考实现 ──
// 部署到任意 Node.js 环境（Express/Hono/Fastify），密钥从服务端环境变量读取

export const PROXY_SERVER_NODE = `
// ═══════════════════════════════════════════════════════
// YYC³ LLM Proxy Server (Node.js / Express)
// 密钥仅在服务端——浏览器零密钥暴露
// ═══════════════════════════════════════════════════════
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*" }));
app.use(express.json({ limit: "10mb" }));

// ── 服务端密钥（从环境变量读取，绝不进代码）──
const SERVER_KEYS = {
  "zai-plan": process.env.ZHIPU_API_KEY,
  ollama: undefined, // 本地 Ollama 无需密钥
};

// ── 健康检查 ──
app.get("/health", (req, res) => {
  res.json({ healthy: true, version: "1.0.0", ts: Date.now() });
});

// ── LLM 代理转发 ──
app.post("/:provider/*", async (req, res) => {
  const { provider } = req.params;
  const endpoint = req.path.replace(\`/\\\${provider}\`, "");

  const serverKey = SERVER_KEYS[provider];
  if (!serverKey && provider !== "ollama") {
    return res.status(503).json({ error: \`Provider \\\${provider} 未配置服务端密钥\` });
  }

  // 构建上游请求
  const upstreamUrl = provider === "ollama"
    ? \\\`http://localhost:11434\\\${endpoint}\\\`
    : \\\`https://open.bigmodel.cn/api/coding/paas/v4\\\${endpoint}\\\`;

  const headers = {
    "Content-Type": "application/json",
    ...(serverKey && { Authorization: \\\`Bearer \\\${serverKey}\\\` }),
  };

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(req.body),
    });

    // 流式透传
    if (req.body.stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      return pump();
    }

    // 非流式
    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 8080);
`;

export default {
  getProxyConfig,
  updateProxyConfig,
  isProxyEnabled,
  isProxyHealthy,
  smartChatCompletion,
  smartChatCompletionStream,
};
