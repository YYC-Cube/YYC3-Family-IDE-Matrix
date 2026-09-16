/**
 * @file: services/agent/__tests__/AgentFleet.test.ts
 * @description: AgentFleet 单元测试 — 路由/熔断降级/回落直连/指标快照
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @tags: [test],[agent],[fleet],[circuit-breaker]
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_FLEET,
  AgentFleet,
  DEFAULT_AGENT,
  type AgentChatResponse,
  type AgentHealth,
} from "../AgentFleet";

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../llm/LLMService", () => ({
  findAvailableProvider: vi.fn(),
}));
vi.mock("../../llm/proxyAdapter", () => ({
  smartChatCompletion: vi.fn(),
}));
vi.mock("../../pipeline/SystemPromptBuilder", () => ({
  buildSystemPrompt: vi.fn(
    (_intent: unknown, _ctx: unknown, options?: { agentPersona?: string }) =>
      `mock-system-prompt:${options?.agentPersona ?? ""}`,
  ),
}));


import { findAvailableProvider } from "../../llm/LLMService";
import { smartChatCompletion } from "../../llm/proxyAdapter";
import { buildSystemPrompt } from "../../pipeline/SystemPromptBuilder";

const mockSmartChat = vi.mocked(smartChatCompletion);
const mockFindProvider = vi.mocked(findAvailableProvider);

// ── fetch mock 工具 ──

const healthStub: AgentHealth = {
  status: "healthy",
  agent: "yuanqi-tianshu",
  label: "元启天枢",
  role: "总控编排",
  uptime_seconds: 100,
  vllm_reachable: true,
  model: "Qwen/Qwen3.6-27B-FP8",
  frozen: false,
  frozen_reason: "",
  governance_connected: "http://localhost:25700",
  timestamp: new Date().toISOString(),
};

function chatResponse(agent: string): AgentChatResponse {
  return {
    agent,
    label: agent,
    role: "test",
    response: `来自 ${agent} 的回复`,
    usage: { prompt_tokens: 10, completion_tokens: 20 },
    latency_ms: 123,
    timestamp: new Date().toISOString(),
  };
}

function mockFetch(handler: (url: string) => { status: number; body: unknown } | never) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const out = handler(url);
    return new Response(JSON.stringify(out.body), { status: out.status });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindProvider.mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── 编制 ──

describe("AGENT_FLEET 编制", () => {
  it("8 位成员端口连续 25600-25607", () => {
    expect(AGENT_FLEET).toHaveLength(8);
    AGENT_FLEET.forEach((a, i) => expect(a.port).toBe(25600 + i));
  });

  it("默认路由为元启天枢（总控）", () => {
    expect(DEFAULT_AGENT.id).toBe("yuanqi-tianshu");
  });
});

// ── 路由 ──

describe("routeTask", () => {
  const fleet = new AgentFleet();

  it("代码生成 → 言启千行", () => {
    expect(fleet.routeTask("帮我生成一个登录组件").id).toBe("yanqi-qianhang");
  });

  it("安全审计 → 智云守护", () => {
    expect(fleet.routeTask("检查这个漏洞").id).toBe("zhiyun-shouhu");
  });

  it("测试质量 → 格物宗师", () => {
    expect(fleet.routeTask("写测试用例").id).toBe("gewu-zongshi");
  });

  it("未命中关键词 → 默认元启天枢", () => {
    expect(fleet.routeTask("你好呀").id).toBe("yuanqi-tianshu");
  });
});

// ── health ──

describe("health", () => {
  it("探测单个 Agent 健康状态", async () => {
    const fetchSpy = mockFetch(() => ({ status: 200, body: healthStub }));
    const fleet = new AgentFleet();
    const h = await fleet.health("yuanqi-tianshu");
    expect(h.status).toBe("healthy");
    expect(fetchSpy.mock.calls[0][0]).toBe("http://localhost:25600/health");
  });

  it("healthAll 并行探测且单点失败不阻断", async () => {
    mockFetch((url) =>
      url.includes(":25601")
        ? { status: 500, body: { error: "boom" } }
        : { status: 200, body: healthStub },
    );
    const fleet = new AgentFleet();
    const all = await fleet.healthAll();
    expect(Object.keys(all)).toHaveLength(8);
    expect((all["yuanqi-tianshu"] as AgentHealth).status).toBe("healthy");
    expect(all["yanqi-qianhang"]).toHaveProperty("error");
  });
});

// ── chat + 熔断 ──

describe("chat 与熔断降级", () => {
  it("成功调用 /chat 并复位熔断", async () => {
    const fetchSpy = mockFetch(() => ({
      status: 200,
      body: chatResponse("yanqi-qianhang"),
    }));
    const fleet = new AgentFleet();
    const result = await fleet.chat("yanqi-qianhang", { message: "生成代码" });

    expect(result.response).toBe("来自 yanqi-qianhang 的回复");
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toBe("http://localhost:25601/chat");
  });

  it("连续失败达到阈值 → 熔断开启并拒绝后续请求", async () => {
    mockFetch(() => ({ status: 503, body: { error: "vllm down" } }));
    const fleet = new AgentFleet({ failureThreshold: 2, cooldownMs: 60_000 });

    await expect(fleet.chat("yushu-wanwu", { message: "x" })).rejects.toThrow();
    await expect(fleet.chat("yushu-wanwu", { message: "x" })).rejects.toThrow();
    // 第 3 次请求被熔断直接拒绝，fetch 未被调用
    const before = (globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls.length;
    await expect(fleet.chat("yushu-wanwu", { message: "x" })).rejects.toThrow("熔断");
    const after = (globalThis.fetch as ReturnType<typeof vi.spyOn>).mock.calls.length;
    expect(after).toBe(before);
  });

  it("冻结（403 + reason）错误信息携带 frozen_reason", async () => {
    mockFetch(() => ({
      status: 403,
      body: { error: "Agent is frozen", reason: "预算超限" },
    }));
    const fleet = new AgentFleet();
    await expect(fleet.chat("zhiyu-bole", { message: "x" })).rejects.toThrow("预算超限");
  });

  it("熔断冷却结束后进入半开放行", async () => {
    mockFetch(() => ({ status: 200, body: chatResponse("zhiyun-shouhu") }));
    // 冷却 0ms：熔断立即恢复探测
    const fleet = new AgentFleet({ failureThreshold: 1, cooldownMs: 0 });

    // 先制造一次熔断
    mockFetch(() => ({ status: 500, body: { error: "x" } }));
    await expect(fleet.chat("zhiyun-shouhu", { message: "x" })).rejects.toThrow();

    // 冷却 0ms 后立即可用
    mockFetch(() => ({ status: 200, body: chatResponse("zhiyun-shouhu") }));
    const result = await fleet.chat("zhiyun-shouhu", { message: "x" });
    expect(result.response).toContain("zhiyun-shouhu");
  });
});

// ── routeAndChat + 回落 ──

describe("routeAndChat 回落直连", () => {
  it("舰队可用 → via=fleet", async () => {
    mockFetch(() => ({ status: 200, body: chatResponse("gewu-zongshi") }));
    const fleet = new AgentFleet();
    const out = await fleet.routeAndChat("重构这段代码");

    expect(out.agent.id).toBe("gewu-zongshi");
    expect(out.via).toBe("fleet");
    expect((out.result as AgentChatResponse).agent).toBe("gewu-zongshi");
  });

  it("舰队不可用 → 回落直连 LLM（agentPersona 注入）", async () => {
    mockFindProvider.mockReturnValue({
      config: {
        id: "zai-plan",
        name: "t",
        nameEn: "t",
        baseUrl: "http://x",
        authType: "bearer",
        models: [],
        isLocal: false,
        detected: true,
        description: "",
        docsUrl: "",
      },
      modelId: "m",
    } as never);
    mockSmartChat.mockResolvedValue("直连回复");

    mockFetch(() => ({ status: 500, body: { error: "down" } }));
    const fleet = new AgentFleet({ failureThreshold: 99 });
    const out = await fleet.routeAndChat("写文档");

    expect(out.agent.id).toBe("yushu-wanwu");
    expect(out.via).toBe("fallback");
    expect((out.result as { response: string }).response).toBe("直连回复");
    // persona 注入 system prompt（经 buildSystemPrompt options.agentPersona）
    expect(mockSmartChat.mock.calls[0][2][0].content).toContain("语枢万物");
    expect(vi.mocked(buildSystemPrompt)).toHaveBeenCalledWith(
      "general",
      null,
      expect.objectContaining({ agentPersona: expect.stringContaining("语枢万物") }),
    );
  });

  it("舰队与直连均不可用 → 抛出明确错误", async () => {
    mockFetch(() => ({ status: 500, body: { error: "down" } }));
    const fleet = new AgentFleet({ failureThreshold: 99 });
    await expect(fleet.routeAndChat("规划任务")).rejects.toThrow("无可用直连 LLM");
  });
});

// ── 指标 ──

describe("getMetricsSnapshot", () => {
  it("请求/成功/失败/延迟统计正确", async () => {
    mockFetch(() => ({ status: 200, body: chatResponse("yuanqi-tianshu") }));
    const fleet = new AgentFleet();

    await fleet.chat("yuanqi-tianshu", { message: "a" });
    await fleet.chat("yuanqi-tianshu", { message: "b" });
    // 其他 agent 制造失败
    mockFetch(() => ({ status: 500, body: { error: "x" } }));
    await expect(fleet.chat("yujian-xianzhi", { message: "x" })).rejects.toThrow();

    const snapshot = fleet.getMetricsSnapshot();
    const tianshu = snapshot.find((s) => s.agentId === "yuanqi-tianshu")!;
    expect(tianshu.requests).toBe(2);
    expect(tianshu.successes).toBe(2);
    expect(tianshu.failures).toBe(0);
    expect(tianshu.avgLatencyMs).toBeGreaterThanOrEqual(0);
    expect(tianshu.circuitOpen).toBe(false);

    const xianzhi = snapshot.find((s) => s.agentId === "yujian-xianzhi")!;
    expect(xianzhi.failures).toBe(1);
    expect(snapshot).toHaveLength(8);
  });
});
