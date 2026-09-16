/**
 * @file: services/agent/AgentFleet.ts
 * @description: 8-Agent 舰队适配器 — 桥接 YYC³ FAmily-AI Agent Server（:25600-25607）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @updated: 2026-09-17
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: [agent,fleet,fleet-adapter,circuit-breaker,metrics]
 *
 * brief: 对接 docs/YYC3-AI-Family-Agent-编程体系/yyc3-family-ai-agents/agent_server.py
 *        v3.1（Flask，集成治理中枢 :25700）。每个 Agent 暴露 /health /chat /status
 *        /capabilities /identity。本适配器提供：
 *        - 关键词路由（双语）→ 端口寻址
 *        - 熔断降级（连续失败 N 次开路，冷却后半开）
 *        - 舰队不可达时回落直连 LLM（复用 pipeline 的 agentPersona 注入点）
 *        - 指标快照（请求/成功/失败/延迟），供 metrics 管道与治理中枢聚合
 */

import { logger } from "../../lib/logger";
import { findAvailableProvider } from "../llm/LLMService";
import { smartChatCompletion } from "../llm/proxyAdapter";
import { buildSystemPrompt } from "../pipeline/SystemPromptBuilder";

// ── 舰队编制 ──

export type AgentId =
  | "yuanqi-tianshu"
  | "yanqi-qianhang"
  | "yushu-wanwu"
  | "yujian-xianzhi"
  | "zhiyu-bole"
  | "zhiyun-shouhu"
  | "gewu-zongshi"
  | "chuangxiang-lingyun";

export interface AgentSpec {
  id: AgentId;
  /** 中文名 */
  label: string;
  port: number;
  /** 角色定位 */
  role: string;
  /** 人设注入（回落直连 LLM 时用） */
  persona: string;
  /** 路由关键词（中英双语，命中计分） */
  keywords: string[];
}

export const AGENT_FLEET: AgentSpec[] = [
  {
    id: "yuanqi-tianshu",
    label: "元启天枢",
    port: 25600,
    role: "总控编排",
    persona: "元启天枢 — YYC³ 舰队总指挥，负责任务分解、编排与裁决。",
    keywords: ["编排", "总控", "规划", "协调", "orchestrate", "plan", "coordinate"],
  },
  {
    id: "yanqi-qianhang",
    label: "言启千行",
    port: 25601,
    role: "代码生成",
    persona: "言启千行 — 代码生成大师，一言启千行，产出完整可运行代码。",
    keywords: ["生成", "创建", "写代码", "实现", "generate", "create", "code", "implement"],
  },
  {
    id: "yushu-wanwu",
    label: "语枢万物",
    port: 25602,
    role: "语言与文档",
    persona: "语枢万物 — 语言枢纽，精通文档撰写、翻译与文案。",
    keywords: ["文档", "翻译", "文案", "README", "doc", "translate", "writing"],
  },
  {
    id: "yujian-xianzhi",
    label: "预见先知",
    port: 25603,
    role: "预测分析",
    persona: "预见先知 — 趋势预测与风险预警分析师。",
    keywords: ["预测", "趋势", "风险", "预警", "predict", "forecast", "trend", "risk"],
  },
  {
    id: "zhiyu-bole",
    label: "知遇伯乐",
    port: 25604,
    role: "人才评估",
    persona: "知遇伯乐 — 人才识别与团队配置顾问。",
    keywords: ["人才", "招聘", "评估", "团队", "talent", "hire", "recruit", "team"],
  },
  {
    id: "zhiyun-shouhu",
    label: "智云守护",
    port: 25605,
    role: "安全守护",
    persona: "智云守护 — 安全审计与漏洞防护专家。",
    keywords: ["安全", "漏洞", "防护", "审计", "security", "vulnerability", "audit"],
  },
  {
    id: "gewu-zongshi",
    label: "格物宗师",
    port: 25606,
    role: "质量格致",
    persona: "格物宗师 — 测试与质量格致大师，穷理尽性。",
    keywords: ["测试", "质量", "审查", "重构", "test", "quality", "review", "refactor"],
  },
  {
    id: "chuangxiang-lingyun",
    label: "创想灵韵",
    port: 25607,
    role: "创意设计",
    persona: "创想灵韵 — 创意设计与灵感启发专家。",
    keywords: ["创意", "设计", "灵感", "brainstorm", "design", "idea", "creative"],
  },
];

/** 舰队默认路由对象（未命中关键词时） */
export const DEFAULT_AGENT = AGENT_FLEET[0];

// ── 配置 ──

export interface AgentFleetConfig {
  /** 舰队宿主机地址 */
  baseUrl: string;
  /** /chat 超时（服务端 vLLM 上限 120s，客户端留余量） */
  timeoutMs: number;
  /** 熔断阈值：连续失败 N 次开路 */
  failureThreshold: number;
  /** 熔断冷却时长（ms），冷却后进入半开探测 */
  cooldownMs: number;
}

const DEFAULT_CONFIG: AgentFleetConfig = {
  baseUrl: "http://localhost",
  timeoutMs: 130_000,
  failureThreshold: 3,
  cooldownMs: 60_000,
};

// ── 响应类型（对齐 agent_server.py v3.1）──

export interface AgentHealth {
  status: "healthy" | "degraded" | "frozen";
  agent: string;
  label: string;
  role: string;
  uptime_seconds: number;
  vllm_reachable: boolean;
  model: string;
  frozen: boolean;
  frozen_reason: string;
  governance_connected: string;
  timestamp: string;
}

export interface AgentChatInput {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

export interface AgentChatResponse {
  agent: string;
  label: string;
  role: string;
  response: string;
  usage: Record<string, number>;
  latency_ms: number;
  collaboration?: { should_collaborate: boolean };
  timestamp: string;
}

// ── 指标快照（metrics 管道对接面）──

export interface AgentMetricsSnapshot {
  agentId: AgentId;
  requests: number;
  successes: number;
  failures: number;
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
  circuitOpen: boolean;
}

// ── 熔断器 ──

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

// ── 舰队适配器 ──

export class AgentFleet {
  private config: AgentFleetConfig;
  private circuits = new Map<AgentId, CircuitState>();
  private metrics = new Map<
    AgentId,
    { requests: number; successes: number; failures: number; latencies: number[] }
  >();

  constructor(config?: Partial<AgentFleetConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    for (const a of AGENT_FLEET) {
      this.circuits.set(a.id, { failures: 0, openedAt: null });
      this.metrics.set(a.id, { requests: 0, successes: 0, failures: 0, latencies: [] });
    }
  }

  /** 端点寻址 */
  endpoint(agent: AgentSpec, path: string): string {
    return `${this.config.baseUrl}:${agent.port}${path}`;
  }

  // ── 健康探测 ──

  async health(agentId: AgentId, timeoutMs = 8_000): Promise<AgentHealth> {
    const agent = this.requireAgent(agentId);
    return this.fetchJson(this.endpoint(agent, "/health"), {
      method: "GET",
      timeoutMs,
    }) as Promise<AgentHealth>;
  }

  /** 并行探测全舰队；单点失败以 { error } 占位不阻断整体 */
  async healthAll(): Promise<Record<AgentId, AgentHealth | { error: string }>> {
    const results = await Promise.all(
      AGENT_FLEET.map(async (a) => {
        try {
          return [a.id, await this.health(a.id)] as const;
        } catch (err) {
          return [a.id, { error: (err as Error).message }] as const;
        }
      }),
    );
    return Object.fromEntries(results) as Record<AgentId, AgentHealth | { error: string }>;
  }

  // ── 舰队对话 ──

  /**
   * 调用指定 Agent 的 /chat。冻结（403）与网络失败均计入熔断。
   * @throws Error — 冻结/网络失败（消息含 frozen_reason 或网络错误详情）
   */
  async chat(agentId: AgentId, input: AgentChatInput): Promise<AgentChatResponse> {
    const agent = this.requireAgent(agentId);
    this.assertCircuitAvailable(agentId);

    const m = this.metrics.get(agentId)!;
    m.requests += 1;

    try {
      const started = performance.now();
      const result = await this.fetchJson(this.endpoint(agent, "/chat"), {
        method: "POST",
        timeoutMs: this.config.timeoutMs,
        body: JSON.stringify({
          message: input.message,
          history: input.history ?? [],
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 4096,
        }),
      }) as AgentChatResponse;

      const latency = performance.now() - started;
      m.successes += 1;
      m.latencies.push(latency);
      if (m.latencies.length > 100) m.latencies.shift();
      this.resetCircuit(agentId);
      return result;
    } catch (err) {
      m.failures += 1;
      this.recordFailure(agentId);
      throw err;
    }
  }

  // ── 路由 + 降级回落 ──

  /** 关键词计分路由（命中数多者优先；平票/未命中 → 元启天枢总控） */
  routeTask(task: string): AgentSpec {
    let best: AgentSpec = DEFAULT_AGENT;
    let bestScore = 0;
    for (const agent of AGENT_FLEET) {
      const score = agent.keywords.reduce(
        (n, kw) => (task.toLowerCase().includes(kw.toLowerCase()) ? n + 1 : n),
        0,
      );
      if (score > bestScore) {
        best = agent;
        bestScore = score;
      }
    }
    return best;
  }

  /**
   * 路由 → 舰队对话 → 失败回落直连 LLM（agentPersona 人设注入，五维五高之高可用）。
   */
  async routeAndChat(
    task: string,
    input?: Partial<AgentChatInput>,
  ): Promise<{
    agent: AgentSpec;
    via: "fleet" | "fallback";
    result: AgentChatResponse | { response: string; latency_ms: number };
  }> {
    const agent = this.routeTask(task);
    try {
      const result = await this.chat(agent.id, { message: task, ...input });
      return { agent, via: "fleet", result };
    } catch (err) {
      logger.warn(`[AgentFleet] ${agent.label} 不可用，回落直连 LLM:`, (err as Error).message);
      const fallback = await this.fallbackChat(agent, task);
      return { agent, via: "fallback", result: fallback };
    }
  }

  /** 回落通道：复用 pipeline 的 agentPersona 注入点直连 proxyAdapter */
  private async fallbackChat(
    agent: AgentSpec,
    task: string,
  ): Promise<{ response: string; latency_ms: number }> {
    const providerInfo = findAvailableProvider();
    if (!providerInfo) {
      throw new Error("舰队不可达且无可用直连 LLM Provider");
    }
    const systemPrompt = buildSystemPrompt("general", null, {
      agentPersona: agent.persona,
    });
    const started = performance.now();
    const reply = await smartChatCompletion(
      providerInfo.config,
      providerInfo.modelId,
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: task },
      ],
      { temperature: 0.7 },
    );
    return {
      response: typeof reply === "string" ? reply : JSON.stringify(reply),
      latency_ms: Math.round(performance.now() - started),
    };
  }

  // ── 指标 ──

  /** 指标快照 — 供 collect-metrics 管道与治理中枢（:25700）聚合 */
  getMetricsSnapshot(): AgentMetricsSnapshot[] {
    return AGENT_FLEET.map((a) => {
      const m = this.metrics.get(a.id)!;
      const circuit = this.circuits.get(a.id)!;
      return {
        agentId: a.id,
        requests: m.requests,
        successes: m.successes,
        failures: m.failures,
        lastLatencyMs: m.latencies.at(-1) ?? null,
        avgLatencyMs:
          m.latencies.length > 0
            ? Math.round(m.latencies.reduce((s, v) => s + v, 0) / m.latencies.length)
            : null,
        circuitOpen: this.isCircuitOpen(circuit),
      };
    });
  }

  // ── 内部工具 ──

  private requireAgent(agentId: AgentId): AgentSpec {
    const agent = AGENT_FLEET.find((a) => a.id === agentId);
    if (!agent) throw new Error(`未知 Agent: ${agentId}`);
    return agent;
  }

  private isCircuitOpen(c: CircuitState): boolean {
    if (c.openedAt === null) return false;
    // 冷却结束 → 半开（放行探测请求）
    if (Date.now() - c.openedAt >= this.config.cooldownMs) return false;
    return true;
  }

  private assertCircuitAvailable(agentId: AgentId): void {
    const circuit = this.circuits.get(agentId)!;
    if (this.isCircuitOpen(circuit)) {
      const remain = Math.ceil(
        (this.config.cooldownMs - (Date.now() - (circuit.openedAt ?? 0))) / 1000,
      );
      throw new Error(`Agent ${agentId} 熔断中，约 ${remain}s 后恢复探测`);
    }
  }

  private recordFailure(agentId: AgentId): void {
    const circuit = this.circuits.get(agentId)!;
    circuit.failures += 1;
    if (circuit.failures >= this.config.failureThreshold) {
      circuit.openedAt = Date.now();
      logger.warn(`[AgentFleet] ${agentId} 连续失败 ${circuit.failures} 次，熔断开启`);
    }
  }

  private resetCircuit(agentId: AgentId): void {
    this.circuits.set(agentId, { failures: 0, openedAt: null });
  }

  /** fetch + AbortController 超时封装 */
  private async fetchJson(
    url: string,
    init: { method: "GET" | "POST"; timeoutMs: number; body?: string },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: init.method,
        headers: init.body ? { "Content-Type": "application/json" } : undefined,
        body: init.body,
        signal: controller.signal,
      });
      if (!resp.ok) {
        // 403 携带冻结原因（治理中枢联动）
        let detail = resp.statusText;
        try {
          const body = (await resp.json()) as { error?: string; reason?: string };
          if (body?.reason) detail = `已冻结: ${body.reason}`;
        } catch {
          /* 非 JSON 错误体，退回 statusText */
        }
        throw new Error(`Agent Server ${resp.status}: ${detail}`);
      }
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }
}

/** 舰队单例 */
export const agentFleet = new AgentFleet();

export default AgentFleet;
