/**
 * @file: LLMService.test.ts
 * @description: LLM 调用层单测 — Provider 转换 / Key 存储 / 端点与 Header / 非流式+流式调用
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[llm],[service],[stream]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  convertToProviderConfig,
  getProviderConfigs,
  getProviderConfig,
  getApiKey,
  setApiKey,
  hasApiKey,
  getChatEndpoint,
  buildHeaders,
  chatCompletion,
  chatCompletionStream,
  extractCodeBlock,
  findAvailableProvider,
} from "../LLMService";
import { ZAI_PLAN_PROVIDER, OLLAMA_PROVIDER } from "../providers";
import type { ProviderConfig } from "../types";

/** 构造可用 ProviderConfig 的便捷函数 */
function zaiConfig(): ProviderConfig {
  return convertToProviderConfig(ZAI_PLAN_PROVIDER);
}
function ollamaConfig(): ProviderConfig {
  return convertToProviderConfig(OLLAMA_PROVIDER);
}

/** SSE 流式 Response 替身（绕开 jsdom ReadableStream 兼容性） */
function sseResponse(chunks: string[], init?: { ok?: boolean; status?: number; statusText?: string }): Response {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? "OK",
    body: {
      getReader: () => ({
        read: async () =>
          index < chunks.length
            ? { done: false, value: encoder.encode(chunks[index++]) }
            : { done: true, value: undefined },
        releaseLock: () => {},
      }),
    },
  } as unknown as Response;
}

describe("Provider 配置转换", () => {
  it("zai-plan 转换为 bearer 认证云端配置，模型上下文窗口解析 128K → 128000", () => {
    const config = zaiConfig();
    expect(config.id).toBe("zai-plan");
    expect(config.authType).toBe("bearer");
    expect(config.isLocal).toBe(false);
    expect(config.models).toHaveLength(3);
    expect(config.models[0].id).toBe("glm-5");
    expect(config.models[0].contextWindow).toBe(128000);
  });

  it("ollama 转换为 none 认证本地配置且无预设模型", () => {
    const config = ollamaConfig();
    expect(config.authType).toBe("none");
    expect(config.isLocal).toBe(true);
    expect(config.detected).toBe(true);
    expect(config.models).toHaveLength(0);
  });

  it("getProviderConfigs 返回两个 provider 且 ollama 在前（本地优先）", () => {
    const configs = getProviderConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[0].id).toBe("ollama");
  });

  it("getProviderConfig 按 id 精确获取", () => {
    expect(getProviderConfig("zai-plan")?.nameEn).toBe("智谱");
  });
});

describe("API Key 存储", () => {
  beforeEach(() => localStorage.clear());

  it("set/get/has 往返一致，空值移除", () => {
    expect(hasApiKey("zai-plan")).toBe(false);
    setApiKey("zai-plan", "sk-test");
    expect(getApiKey("zai-plan")).toBe("sk-test");
    expect(hasApiKey("zai-plan")).toBe(true);
    setApiKey("zai-plan", "");
    expect(hasApiKey("zai-plan")).toBe(false);
  });
});

describe("端点与 Header 构建", () => {
  beforeEach(() => localStorage.clear());

  it("ollama 使用原生 /api/chat，zai-plan 走代理路径", () => {
    expect(getChatEndpoint(ollamaConfig())).toBe("http://localhost:11434/api/chat");
    expect(getChatEndpoint(zaiConfig())).toBe("/api/zhipu/chat/completions");
  });

  it("bearer 配置 Key 后携带 Authorization，none 不携带", () => {
    setApiKey("zai-plan", "sk-abc");
    expect(buildHeaders(zaiConfig())["Authorization"]).toBe("Bearer sk-abc");

    const headers = buildHeaders(ollamaConfig());
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBeUndefined();
  });
});

describe("chatCompletion 非流式调用", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("OpenAI 兼容格式解析 choices[0].message.content", async () => {
    setApiKey("zai-plan", "sk-x");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "你好" } }] }), { status: 200 })
    );

    const reply = await chatCompletion(zaiConfig(), "glm-5", [{ role: "user", content: "hi" }]);
    expect(reply).toBe("你好");

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body.model).toBe("glm-5");
    expect(body.stream).toBe(false);
  });

  it("ollama 格式解析 message.content", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: { content: "本地回复" } }), { status: 200 })
    );
    const reply = await chatCompletion(ollamaConfig(), "llama3", [{ role: "user", content: "hi" }]);
    expect(reply).toBe("本地回复");
  });

  it("HTTP 错误时抛出带 provider 名与状态码的错误", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("rate limited", { status: 429 }));
    await expect(
      chatCompletion(zaiConfig(), "glm-5", [{ role: "user", content: "hi" }])
    ).rejects.toThrow(/API 错误 429/);
  });
});

describe("chatCompletionStream 流式调用", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("标准 SSE：逐 token 回调并以 [DONE] 结束", async () => {
    const tokens: string[] = [];
    let doneText = "";
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
        "data: [DONE]\n\n",
      ])
    );

    await chatCompletionStream(
      zaiConfig(),
      "glm-5",
      [{ role: "user", content: "hi" }],
      {
        onToken: (t) => tokens.push(t),
        onDone: (full) => (doneText = full),
        onError: (e) => { throw new Error(e); },
      }
    );

    expect(tokens).toEqual(["你", "好"]);
    expect(doneText).toBe("你好");
  });

  it("ollama JSON-per-line 流式格式", async () => {
    const tokens: string[] = [];
    let doneText = "";
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        JSON.stringify({ message: { content: "本" }, done: false }) + "\n",
        JSON.stringify({ message: { content: "地" }, done: false }) + "\n",
        JSON.stringify({ message: { content: "" }, done: true }) + "\n",
      ])
    );

    await chatCompletionStream(
      ollamaConfig(),
      "llama3",
      [{ role: "user", content: "hi" }],
      {
        onToken: (t) => tokens.push(t),
        onDone: (full) => (doneText = full),
        onError: (e) => { throw new Error(e); },
      }
    );

    expect(tokens).toEqual(["本", "地"]);
    expect(doneText).toBe("本地");
  });

  it("网络失败走 onError 而非抛出", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("boom"));
    const onError = vi.fn();
    await chatCompletionStream(
      ollamaConfig(), "llama3", [{ role: "user", content: "hi" }],
      { onToken: () => {}, onDone: () => {}, onError }
    );
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("网络错误"));
  });
});

describe("extractCodeBlock", () => {
  it("提取带语言标识的代码块，缺省语言回退 tsx", () => {
    expect(extractCodeBlock("前文\n```ts\nconst a = 1;\n```\n后文")).toEqual({
      lang: "ts",
      code: "const a = 1;",
    });
    expect(extractCodeBlock("```\nconst b = 2;\n```")?.lang).toBe("tsx");
  });

  it("无代码块返回 null", () => {
    expect(extractCodeBlock("普通文本")).toBeNull();
  });
});

describe("findAvailableProvider", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("localStorage 中有活跃模型配置时优先采用", () => {
    setApiKey("zai-plan", "sk-active");
    localStorage.setItem(
      "yyc3_active_model",
      JSON.stringify({ providerId: "zai-plan", modelId: "glm-5.1" })
    );
    const found = findAvailableProvider();
    expect(found?.config.id).toBe("zai-plan");
    expect(found?.modelId).toBe("glm-5.1");
  });

  it("无配置时本地优先回退到 ollama（authType none 视为可用）", () => {
    const found = findAvailableProvider();
    expect(found?.config.id).toBe("ollama");
  });
});
