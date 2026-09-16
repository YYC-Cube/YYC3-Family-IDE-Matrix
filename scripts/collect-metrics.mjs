#!/usr/bin/env node
/**
 * @file: scripts/collect-metrics.mjs
 * @description: YYC³ 六源指标聚合管道 — 舰队健康/治理中枢/预算/质量门禁/构建产物/运行时
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @status: active
 * @license: MIT
 * @tags: [metrics],[observability],[agent-fleet],[governance]
 *
 * brief: 五标之「可视化」与「智能化」的数据底座。六源独立采集、优雅降级
 *        （单源失败不阻断整体），产出统一快照 metrics/latest.json。
 *
 * 用法:
 *   node scripts/collect-metrics.mjs              # 快速采集（质量源仅 tsc）
 *   node scripts/collect-metrics.mjs --full       # 质量源附加 vitest + build
 *   FLEET_BASE_URL=http://10.0.0.5 node ...      # 舰队/治理中枢宿主机可配
 *
 * 六源定义:
 *   1. fleet      — 8-Agent 舰队健康（:25600-25607 /health，对齐 agent_server.py v3.1）
 *   2. governance — 治理中枢仪表盘（:25700 /dashboard：token/风险/协同/上下文图谱）
 *   3. budget     — 预算看板（:25700 /budget/dashboard）
 *   4. quality    — 质量门禁（tsc 必跑；--full 时附加 vitest + vite build）
 *   5. bundle     — 构建产物（ide/dist 体积/文件数，需先 build 或 --full）
 *   6. runtime    — 采集器自身运行时（Node 版本/内存/耗时）
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const IDE = join(ROOT, "ide");
const OUT_DIR = join(ROOT, "metrics");
const OUT_FILE = join(OUT_DIR, "latest.json");

const FULL = process.argv.includes("--full");
const FLEET_BASE_URL = process.env.FLEET_BASE_URL ?? "http://localhost";
const GOVERNANCE_URL = process.env.GOVERNANCE_URL ?? "http://localhost:25700";
const FLEET_PORTS = [25600, 25601, 25602, 25603, 25604, 25605, 25606, 25607];
const FLEET_LABELS = [
  "元启天枢", "言启千行", "语枢万物", "预见先知",
  "知遇伯乐", "智云守护", "格物宗师", "创想灵韵",
];

const startedAt = Date.now();

// ── 工具 ──

async function fetchJson(url, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 单源采集包装：失败降级为 { available:false, error }，不阻断整体 */
async function source(name, collector) {
  const t0 = Date.now();
  try {
    const data = await collector();
    return { source: name, available: true, durationMs: Date.now() - t0, data };
  } catch (err) {
    return {
      source: name,
      available: false,
      durationMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function runCmd(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 300_000 });
  return { exitCode: r.status ?? -1, stderr: (r.stderr || "").slice(-2000) };
}

// ── 源 1: 舰队健康 ──

async function collectFleet() {
  const probes = await Promise.all(
    FLEET_PORTS.map(async (port, i) => {
      const id = FLEET_PORTS[i].toString();
      try {
        const h = await fetchJson(`${FLEET_BASE_URL}:${port}/health`, 6_000);
        return {
          port, id,
          label: h.label ?? FLEET_LABELS[i],
          status: h.status,
          vllmReachable: Boolean(h.vllm_reachable),
          frozen: Boolean(h.frozen),
          uptimeSeconds: h.uptime_seconds ?? null,
        };
      } catch (err) {
        return {
          port, id,
          label: FLEET_LABELS[i],
          status: "unreachable",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
  return {
    baseUrl: FLEET_BASE_URL,
    agents: probes,
    summary: {
      total: probes.length,
      healthy: probes.filter((p) => p.status === "healthy").length,
      degraded: probes.filter((p) => p.status === "degraded").length,
      frozen: probes.filter((p) => p.status === "frozen").length,
      unreachable: probes.filter((p) => p.status === "unreachable").length,
    },
  };
}

// ── 源 2: 治理中枢 ──

async function collectGovernance() {
  const dash = await fetchJson(`${GOVERNANCE_URL}/dashboard`);
  return {
    url: GOVERNANCE_URL,
    agents: dash.agents ?? {},
    behaviorEventsTotal: dash.behavior_events_total ?? null,
    highRiskEvents24h: dash.high_risk_events_24h ?? null,
    tokensConsumed24h: dash.tokens_consumed_24h ?? null,
    collaborations24h: dash.collaborations_24h ?? null,
    contextGraph: dash.context_graph ?? null,
    memory: dash.memory ?? null,
  };
}

// ── 源 3: 预算 ──

async function collectBudget() {
  const dash = await fetchJson(`${GOVERNANCE_URL}/budget/dashboard`);
  return { url: GOVERNANCE_URL, dashboard: dash };
}

// ── 源 4: 质量门禁 ──

async function collectQuality() {
  const tsc = runCmd("pnpm", ["-s", "exec", "tsc", "--noEmit"], IDE);
  const result = {
    tsc: { pass: tsc.exitCode === 0, durationMs: null },
  };
  if (FULL) {
    const vitest = runCmd("pnpm", ["-s", "exec", "vitest", "run", "--reporter=basic"], IDE);
    const build = runCmd("pnpm", ["-s", "exec", "vite", "build"], IDE);
    result.vitest = { pass: vitest.exitCode === 0, tail: vitest.stderr.slice(-500) };
    result.build = { pass: build.exitCode === 0, tail: build.stderr.slice(-500) };
  }
  result.allPass = Object.values(result)
    .filter((v) => typeof v === "object" && v !== null && "pass" in v)
    .every((v) => v.pass);
  return result;
}

// ── 源 5: 构建产物 ──

async function collectBundle() {
  const dist = join(IDE, "dist");
  if (!existsSync(dist)) {
    throw new Error("ide/dist 不存在 — 先执行 build 或使用 --full");
  }
  let totalBytes = 0;
  let fileCount = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else {
        totalBytes += statSync(p).size;
        fileCount += 1;
      }
    }
  };
  walk(dist);
  return {
    path: "ide/dist",
    fileCount,
    totalBytes,
    totalKb: Math.round(totalBytes / 1024),
  };
}

// ── 源 6: 运行时 ──

function collectRuntime() {
  const mem = process.memoryUsage();
  return {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
  };
}

// ── 主流程 ──

const [fleet, governance, budget, quality, bundle, runtime] = await Promise.all([
  source("fleet", collectFleet),
  source("governance", collectGovernance),
  source("budget", collectBudget),
  source("quality", collectQuality),
  source("bundle", collectBundle),
  source("runtime", async () => collectRuntime()),
]);

const snapshot = {
  schema: "yyc3.metrics/v1",
  collectedAt: new Date().toISOString(),
  totalDurationMs: 0, // 占位，下方回填
  sources: { fleet, governance, budget, quality, bundle, runtime },
};

snapshot.totalDurationMs = Date.now() - startedAt;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

// ── 控制台摘要 ──

const line = "─".repeat(56);
console.log(`\nYYC³ 六源指标快照  (${snapshot.collectedAt})\n${line}`);
for (const s of Object.values(snapshot.sources)) {
  const icon = s.available ? "✅" : "❌";
  const detail = s.available
    ? summarize(s.source, s.data)
    : `不可用: ${s.error}`;
  console.log(`${icon} ${s.source.padEnd(12)} ${detail}`);
}
console.log(`${line}\n快照已写入 metrics/latest.json (${snapshot.totalDurationMs}ms)\n`);

function summarize(name, data) {
  switch (name) {
    case "fleet": {
      const s = data.summary;
      return `健康 ${s.healthy}/${s.total}（降级 ${s.degraded} 冻结 ${s.frozen} 失联 ${s.unreachable}）`;
    }
    case "governance":
      return `token24h=${data.tokensConsumed24h ?? "?"} 高危24h=${data.highRiskEvents24h ?? "?"} 协同24h=${data.collaborations24h ?? "?"}`;
    case "budget":
      return `预算条目 ${Object.keys(data.dashboard ?? {}).length}`;
    case "quality":
      return `tsc ${data.tsc.pass ? "通过" : "失败"}${data.allPass ? " · 全部通过" : ""}`;
    case "bundle":
      return `${data.fileCount} 文件 / ${data.totalKb} KB`;
    case "runtime":
      return `Node ${data.node} · RSS ${data.rssMb}MB`;
    default:
      return "";
  }
}
