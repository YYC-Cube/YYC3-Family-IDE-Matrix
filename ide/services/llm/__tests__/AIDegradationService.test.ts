/**
 * @file: AIDegradationService.test.ts
 * @description: AI 降级引擎单测 — 初始选路 / 降级切换 / 熔断跳过 / 兜底值 / 订阅通知
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[ai],[degradation],[circuit-breaker]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AIDegradationService,
  configureAIDegradationService,
  destroyAIDegradationService,
} from "../AIDegradationService";
import { chatCompletion, setApiKey } from "../LLMService";

// 只 mock 网络函数；getProviderConfigs/getApiKey 走真实实现（localStorage 可控）
vi.mock("../LLMService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../LLMService")>();
  return {
    ...actual,
    chatCompletion: vi.fn(),
    chatCompletionStream: vi.fn(),
    testModelConnectivity: vi.fn(),
  };
});

const mockChat = vi.mocked(chatCompletion);

/** 构造测试实例：ollama 指定活跃模型，可选配置 zai-plan Key */
function createService(opts: { withZaiKey?: boolean } = {}) {
  localStorage.clear();
  localStorage.setItem(
    "yyc3_active_model",
    JSON.stringify({ providerId: "ollama", modelId: "yyc3-merged-v3" })
  );
  if (opts.withZaiKey) setApiKey("zai-plan", "sk-test");
  return configureAIDegradationService({
    circuitBreaker: { failureThreshold: 3, successThreshold: 2, timeout: 30000, halfOpenMaxCalls: 1 },
    degradationChain: ["ollama", "zai-plan"],
  });
}

afterEach(() => {
  destroyAIDegradationService();
  localStorage.clear();
  mockChat.mockReset();
});

describe("AIDegradationService", () => {
  it("启动时按降级链选择本地 ollama 为初始 provider", () => {
    const service = createService();
    const state = service.getState();
    expect(state.currentProviderId).toBe("ollama");
    expect(state.currentLevel).toBe("optimal");
    expect(state.providers.map((p) => p.providerId)).toEqual(["ollama", "zai-plan"]);
  });

  it("execute 成功时经由当前 provider 完成调用", async () => {
    const service = createService();
    mockChat.mockResolvedValue("本地回复");

    const reply = await service.chatCompletion([{ role: "user", content: "hi" }]);

    expect(reply).toBe("本地回复");
    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(mockChat.mock.calls[0][0].id).toBe("ollama");
    expect(mockChat.mock.calls[0][1]).toBe("yyc3-merged-v3");
  });

  it("主 provider 失败时降级切换到 zai-plan 并由其完成任务", async () => {
    const service = createService({ withZaiKey: true });
    mockChat
      .mockRejectedValueOnce(new Error("ollama down"))  // ollama 失败
      .mockResolvedValueOnce("云端回复");                 // zai-plan 接管

    const reply = await service.chatCompletion([{ role: "user", content: "hi" }]);

    expect(reply).toBe("云端回复");
    expect(mockChat).toHaveBeenCalledTimes(2);
    expect(mockChat.mock.calls[1][0].id).toBe("zai-plan");

    const state = service.getState();
    expect(state.currentProviderId).toBe("zai-plan");
    expect(state.switchCount).toBeGreaterThanOrEqual(1);
  });

  it("全部 provider 失败时返回兜底空串而非抛出", async () => {
    const service = createService({ withZaiKey: true });
    mockChat.mockRejectedValue(new Error("all down"));

    const reply = await service.chatCompletion([{ role: "user", content: "hi" }]);

    expect(reply).toBe("");
    const state = service.getState();
    const ollama = state.providers.find((p) => p.providerId === "ollama");
    expect(ollama?.consecutiveFailures).toBe(1);
  });

  it("未配置任何可用 provider 时 execute 抛出全不可用错误", async () => {
    localStorage.clear(); // 无活跃模型、无 Key：ollama 无模型可选，zai-plan 无 Key
    const service = configureAIDegradationService({});

    await expect(
      service.execute(async () => "never")
    ).rejects.toThrow("All AI providers are unavailable");
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("订阅者在降级切换时收到状态通知", async () => {
    const service = createService({ withZaiKey: true });
    const listener = vi.fn();
    service.subscribe(listener);

    mockChat
      .mockRejectedValueOnce(new Error("ollama down"))
      .mockResolvedValueOnce("ok");
    await service.chatCompletion([{ role: "user", content: "hi" }]);

    expect(listener).toHaveBeenCalled();
    const last = listener.mock.lastCall[0] as ReturnType<typeof service.getState>;
    expect(last.currentProviderId).toBe("zai-plan");
  });

  it("reset 恢复全部健康状态并重选初始 provider", async () => {
    const service = createService({ withZaiKey: true });
    mockChat.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce("ok");
    await service.chatCompletion([{ role: "user", content: "hi" }]);
    expect(service.getState().currentProviderId).toBe("zai-plan");

    service.reset();

    const state = service.getState();
    expect(state.currentProviderId).toBe("ollama");
    expect(state.switchCount).toBe(0);
    expect(state.providers.every((p) => p.level === "optimal")).toBe(true);
  });

  it("健康检查定时器可启停", () => {
    const service = createService();
    service.startHealthChecks();
    service.stopHealthChecks();
    service.destroy();
    // destroy 后状态清空
    expect(service.getState().providers).toHaveLength(0);
  });
});
