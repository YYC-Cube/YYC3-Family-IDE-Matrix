/**
 * @file: components/agent/FleetChatView.tsx
 * @description: 8-Agent 舰队对话视图 — 路由分发 + 熔断状态 + 回落标识，接入 agentFleet.routeAndChat
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: [agent,fleet,chat,ui]
 *
 * brief: MultiAgentPanel「舰队」标签页内容。用户输入任务 → routeTask 预测路由
 *        → routeAndChat 分发（舰队优先/直连回落）→ 展示回复与元信息。
 *        顶部实时探测舰队健康，熔断/冻结/失联以徽标呈现。
 */

import {
  AlertCircle,
  Loader2,
  Radio,
  Send,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  AGENT_FLEET,
  agentFleet,
  type AgentHealth,
  type AgentSpec,
} from "../../services/agent/AgentFleet";

// ── 类型 ──

interface ChatTurn {
  id: number;
  task: string;
  response: string;
  agent: AgentSpec;
  via: "fleet" | "fallback";
  latencyMs: number;
  error?: string;
}

type HealthState = "checking" | Record<string, AgentHealth | { error: string }>;

let turnSeq = 0;

// ── 组件 ──

export default function FleetChatView() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [healthyCount, setHealthyCount] = useState(0);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const routedPreview = input.trim() ? agentFleet.routeTask(input.trim()) : null;

  // 舰队健康探测（并行 8 路，8s 超时）
  const refreshHealth = useCallback(async () => {
    setHealth("checking");
    try {
      const all = await agentFleet.healthAll();
      setHealth(all);
      setHealthyCount(
        Object.values(all).filter(
          (h) => "status" in h && h.status === "healthy",
        ).length,
      );
    } catch {
      setHealth({});
      setHealthyCount(0);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  // 发送任务
  const send = useCallback(async () => {
    const task = input.trim();
    if (!task || busy) return;

    setBusy(true);
    setInput("");
    try {
      const out = await agentFleet.routeAndChat(task);
      const result = out.result as {
        response: string;
        latency_ms: number;
      };
      setTurns((prev) => [
        ...prev,
        {
          id: ++turnSeq,
          task,
          response: result.response,
          agent: out.agent,
          via: out.via,
          latencyMs: result.latency_ms,
        },
      ]);
    } catch (err) {
      const agent = agentFleet.routeTask(task);
      setTurns((prev) => [
        ...prev,
        {
          id: ++turnSeq,
          task,
          response: "",
          agent,
          via: "fleet",
          latencyMs: 0,
          error: (err as Error).message,
        },
      ]);
    } finally {
      setBusy(false);
      void refreshHealth();
    }
  }, [input, busy, refreshHealth]);

  const healthOf = (id: string): AgentHealth | { error: string } | null =>
    health === "checking" ? null : (health[id] ?? null);

  const statusDot = (id: string) => {
    if (health === "checking") return "bg-slate-500 animate-pulse";
    const h = healthOf(id);
    if (!h || "error" in h) return "bg-slate-600";
    if (h.status === "healthy") return "bg-emerald-400";
    if (h.status === "frozen") return "bg-red-400";
    return "bg-amber-400";
  };

  return (
    <div className="flex flex-col size-full">
      {/* 舰队状态条 */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-(--ide-border-dim)">
        <Radio className="w-3 h-3 text-amber-400" />
        <span className="text-[0.55rem] text-white/40">
          舰队 {health === "checking" ? "探测中…" : `${healthyCount}/8 在线`}
        </span>
        <div className="flex items-center gap-0.5 ml-1">
          {AGENT_FLEET.map((a) => (
            <div
              key={a.id}
              className={`w-1.5 h-1.5 rounded-full ${statusDot(a.id)}`}
              title={`${a.label} :${a.port} — ${a.role}`}
            />
          ))}
        </div>
        <button
          onClick={() => void refreshHealth()}
          className="ml-auto text-[0.48rem] text-white/20 hover:text-white/40 transition-colors"
        >
          重新探测
        </button>
      </div>

      {/* 对话历史 */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {turns.length === 0 && !busy && (
          <div className="py-6 flex flex-col items-center gap-1.5 text-center">
            <Users className="w-5 h-5 text-white/15" />
            <p className="text-[0.55rem] text-white/25">
              输入任务，自动路由至最合适的 Agent
            </p>
            <p className="text-[0.48rem] text-white/15">
              代码生成 → 言启千行 · 安全审计 → 智云守护 · 测试质量 → 格物宗师
            </p>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="space-y-1">
            {/* 用户任务 */}
            <div className="flex items-start gap-1.5 justify-end">
              <div className="max-w-[85%] rounded-lg bg-amber-500/15 border border-amber-500/20 px-2.5 py-1.5">
                <p className="text-[0.55rem] text-white/60 whitespace-pre-wrap">
                  {turn.task}
                </p>
              </div>
            </div>

            {/* Agent 回复 */}
            <div className="flex items-start gap-1.5">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[0.5rem] font-medium ${
                  turn.error
                    ? "bg-red-500/15 text-red-400"
                    : "bg-blue-500/15 text-blue-400"
                }`}
                title={`${turn.agent.label} :${turn.agent.port}`}
              >
                {turn.agent.label.slice(0, 1)}
              </div>
              <div className="max-w-[85%] rounded-lg bg-white/[0.02] border border-white/[0.06] px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[0.48rem] text-blue-400">
                    {turn.agent.label}
                  </span>
                  <span
                    className={`text-[0.42rem] px-1 py-0.5 rounded ${
                      turn.via === "fleet"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                    }`}
                    title={
                      turn.via === "fallback"
                        ? "舰队不可达，已回落直连 LLM"
                        : "经舰队 Agent Server 分发"
                    }
                  >
                    {turn.via === "fleet" ? "舰队" : "回落直连"}
                  </span>
                  {turn.latencyMs > 0 && (
                    <span className="text-[0.42rem] text-white/15">
                      {(turn.latencyMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {turn.error ? (
                  <p className="text-[0.52rem] text-red-400/80 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {turn.error}
                  </p>
                ) : (
                  <pre className="text-[0.52rem] text-white/50 font-sans whitespace-pre-wrap">
                    {turn.response}
                  </pre>
                )}
              </div>
            </div>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-1.5 px-1 py-1">
            <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
            <span className="text-[0.5rem] text-white/25">
              {routedPreview
                ? `${routedPreview.label} 处理中…`
                : "舰队处理中…"}
            </span>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 border-t border-(--ide-border-dim) p-2 space-y-1">
        {routedPreview && input.trim() && (
          <div className="flex items-center gap-1 px-1">
            <Zap className="w-2.5 h-2.5 text-amber-400/70" />
            <span className="text-[0.45rem] text-white/25">
              路由预测: {routedPreview.label}（:{routedPreview.port} ·{" "}
              {routedPreview.role}）
            </span>
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="描述任务，Enter 发送 / Shift+Enter 换行…"
            rows={2}
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[0.58rem] text-white/60 placeholder:text-white/15 focus:outline-none focus:border-amber-500/30 resize-none"
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || busy}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="发送至舰队"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
