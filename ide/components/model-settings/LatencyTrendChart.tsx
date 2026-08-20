/**
 * file: LatencyTrendChart.tsx
 * description: 延迟趋势图表组件 · v3.0 (双主题支持 + LTTB >2000 点降采样)
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v3.0.0
 * created: 2026-07-25
 * updated: 2026-08-19
 * status: active
 * tags: [component],[visualization],[chart],[latency],[performance],[theme]
 *
 * brief: 使用 recharts 展示模型延迟变化趋势；双主题切换 + >2000 点 LTTB 降采样
 *
 * details:
 * v3.0 变更 (双主题体系):
 * - ✨ 接入 useVisualTheme() Hook — 动态从 Context 读取 cyberpunk88 / sunrise 令牌
 * - 🎨 所有颜色/尺寸/间距都从 tokens 派生，不再硬编码默认值
 * - 🪂 无 Provider 环境静默降级为 cyberpunk88 (向后兼容)
 * - 💾 SVG Gradient 颜色按当前主题 tokens.gradients.latencyArea 取
 * - 🔢 Tooltip 延迟语义色: 使用 getSemanticColorForTokens(tokens, status)
 * - 🌈 策略角标颜色: 亮色模式下 amber-600 档更清晰
 *
 * v2.0 能力 (保留):
 * - 🎨 Cyberpunk-88 主题令牌支持
 * - ⚡ LTTB 降采样: >2000 → 400 / >10k → 500 / >50k → 600
 * - 🎯 autoDownsample strategy 提示角标 (展示当前渲染策略)
 * - 🛡️ 数据过滤: NaN / null / Infinity 自动跳过
 * - 💾 Gradient ID 使用 makeChartGradId，多实例不冲突
 * - 🔢 >200 点自动关闭动画
 *
 * dependencies: react, recharts, lucide-react,
 *               visualization/theme.ts,
 *               visualization/useVisualTheme.tsx,
 *               visualization/utils/lttb.ts,
 *               visualization/utils/chartUtils.ts,
 *               ../../constants/storage-keys.ts
 * exports: LatencyTrendChart (默认 + named), buildChartRows
 */

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import type { DiagnosticResult } from "./types";
import { SK_MODEL_PERF_DATA } from "../../constants/storage-keys";

// —— 可视化主题 & 工具 (按单一数据源原则) ——
import { useVisualTheme } from "../visualization/useVisualTheme";
import { autoDownsample, type LTTBPoint } from "../visualization/utils/lttb";
import { makeChartGradId } from "../visualization/utils/chartUtils";
import { getSemanticColorForTokens } from "../visualization/theme";

// ==================================================================
// 0. 内部数据点接口
// ==================================================================

interface ChartRow {
  name: string;
  latency: number;
  status?: string;
  time: string;
  timestamp: number;
  _raw?: unknown;
}

// ==================================================================
// 1. 数据准备函数 (与渲染解耦，便于单元测试)
// ==================================================================

export function buildChartRows(
  diagnostics: Record<string, DiagnosticResult>
): ChartRow[] {
  const rows: ChartRow[] = [];

  if (diagnostics && typeof diagnostics === "object") {
    for (const [key, d] of Object.entries(diagnostics)) {
      if (!d || d.timestamp == null || d.latency == null) continue;
      const latency = Number(d.latency);
      if (!Number.isFinite(latency) || latency < 0) continue;
      rows.push({
        name:
          d.modelName && d.modelName.length > 12
            ? `${d.modelName.slice(0, 12)}…`
            : d.modelName || key,
        latency,
        status: d.status,
        time: d.timestamp
          ? new Date(d.timestamp).toLocaleTimeString("zh-CN", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "",
        timestamp: Number(d.timestamp) || 0,
        _raw: d,
      });
    }
  }

  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(SK_MODEL_PERF_DATA);
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{
          modelName: string;
          latencyMs: number;
          success: boolean;
          timestamp: number;
        }>;
        if (Array.isArray(parsed)) {
          const recent = parsed
            .filter(
              (p) => p != null && Number.isFinite(p.latencyMs) && p.latencyMs > 0
            )
            .slice(-30);
          for (const p of recent) {
            const latency = Number(p.latencyMs);
            if (!Number.isFinite(latency)) continue;
            rows.push({
              name:
                p.modelName && p.modelName.length > 12
                  ? `${p.modelName.slice(0, 12)}…`
                  : p.modelName || "?",
              latency,
              status: p.success ? "success" : "error",
              time: new Date(p.timestamp).toLocaleTimeString("zh-CN", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              timestamp: Number(p.timestamp) || 0,
              _raw: p,
            });
          }
        }
      }
    }
  } catch (_err) {
    /* 静默降级 */
  }

  rows.sort((a, b) => a.timestamp - b.timestamp);
  return rows;
}

// ==================================================================
// 2. 主组件
// ==================================================================

export function LatencyTrendChart({
  diagnostics,
}: {
  diagnostics: Record<string, DiagnosticResult>;
}) {
  // —— v3.0: 从 Context 取当前主题 (单一数据源原则) ——
  const { tokens, isLight, themeId } = useVisualTheme();

  const rawRows = useMemo(() => buildChartRows(diagnostics), [diagnostics]);

  // LTTB 自动降采样
  const { data: sampledRows, strategy } = useMemo(() => {
    const lttbInput: Array<ChartRow & LTTBPoint> = rawRows.map((r) => ({
      ...r,
      x: r.timestamp,
      y: r.latency,
      raw: r,
    }));
    const result = autoDownsample(lttbInput);
    return {
      data: result.data as unknown as ChartRow[],
      strategy: result.strategy,
    };
  }, [rawRows]);

  // SVG Gradient 唯一 ID (避免多实例 ID 冲突)
  const gradId = useMemo(() => makeChartGradId("latency-area"), []);

  // ---- 空状态 (0 数据) ----
  if (sampledRows.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          height: tokens.size.sm,
          borderRadius: tokens.spacing.radius,
          border: `1px solid ${tokens.canvas.border}`,
          background: tokens.canvas.panel,
          padding: tokens.spacing.padding,
        }}
      >
        <div className="text-center">
          <TrendingUp
            className="mx-auto mb-2"
            style={{ width: 20, height: 20, color: tokens.text.disabled }}
          />
          <p style={{ fontSize: 10, color: tokens.text.tertiary }}>暂无延迟数据</p>
          <p style={{ fontSize: 9, color: tokens.text.disabled, marginTop: 2 }}>
            运行诊断检测或启用心跳后显示趋势图
          </p>
        </div>
      </div>
    );
  }

  // >200 点自动关闭动画
  const enableAnimation = sampledRows.length <= 200;

  // 延迟阈值
  const latencyValues = sampledRows.map((r) => r.latency);
  const avgLatency = latencyValues.length
    ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length
    : 0;

  // 颜色 (取自当前主题，而非默认 t 对象)
  const stroke = tokens.primary[500];
  const [gradStart, gradEnd] = tokens.gradients.latencyArea;

  // 策略角标颜色 (亮色: 用 amber-600 档)
  const strategyBadgeColor = isLight
    ? getSemanticColorForTokens(tokens, "warning")
    : tokens.semantic.warning;

  return (
    <div
      style={{
        borderRadius: tokens.spacing.radius,
        border: `1px solid ${tokens.canvas.border}`,
        background: tokens.canvas.panel,
        padding: 12,
      }}
      data-theme={themeId}
    >
      {/* Header: 标题 + 记录数 + 采样策略角标 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center" style={{ gap: 6 }}>
          <TrendingUp
            style={{ width: 14, height: 14, color: `${tokens.primary[500]}99` }}
          />
          <span style={{ fontSize: 10, color: tokens.text.secondary }}>延迟趋势</span>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          {strategy !== "none" && (
            <span
              style={{
                fontSize: 8,
                color: strategyBadgeColor,
                padding: "1px 6px",
                borderRadius: 4,
                border: `1px dashed ${strategyBadgeColor}55`,
              }}
              title={`已自动 LTTB 降采样 (${rawRows.length} → ${sampledRows.length})`}
            >
              LTTB·{strategy.toUpperCase()}
            </span>
          )}
          <span style={{ fontSize: 9, color: tokens.text.disabled }}>
            {sampledRows.length === rawRows.length
              ? `${sampledRows.length} 条`
              : `${sampledRows.length}/${rawRows.length} 条`}
            {avgLatency ? ` · avg ${Math.round(avgLatency)}ms` : ""}
          </span>
        </div>
      </div>

      {/* Chart Body */}
      <div style={{ height: tokens.size.sm }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sampledRows} margin={tokens.spacing.margin}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={gradStart} />
                <stop offset="95%" stopColor={gradEnd} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray={tokens.grid.dashArray}
              stroke={tokens.grid.stroke}
            />
            <XAxis
              dataKey="time"
              tick={{ fill: tokens.axis.tickColor, fontSize: tokens.axis.tickFont }}
              axisLine={{ stroke: tokens.axis.stroke }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: tokens.axis.tickColor, fontSize: tokens.axis.tickFont }}
              axisLine={{ stroke: tokens.axis.stroke }}
              tickLine={false}
              unit="ms"
            />

            <RTooltip
              contentStyle={{
                background: tokens.canvas.bg,
                border: `1px solid ${tokens.canvas.border}`,
                borderRadius: 8,
                fontSize: 10,
                color: tokens.text.secondary,
              }}
              labelStyle={{ color: tokens.text.tertiary, fontSize: 9 }}
              formatter={(value: unknown) => {
                const num = Number(value);
                if (!Number.isFinite(num)) return [`${value}ms`, "延迟"];
                const statusRole =
                  num > avgLatency * 1.5
                    ? "warning"
                    : num > avgLatency * 1.2
                    ? "info"
                    : "success";
                const color = getSemanticColorForTokens(tokens, statusRole);
                return [
                  <span key="val" style={{ color }}>
                    {num}ms
                  </span>,
                  "延迟",
                ];
              }}
            />

            <Area
              type="monotone"
              dataKey="latency"
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={{ fill: stroke, r: 2, strokeWidth: 0 }}
              activeDot={{
                r: 3,
                fill: stroke,
                stroke: tokens.canvas.bg,
                strokeWidth: 2,
              }}
              isAnimationActive={enableAnimation}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default LatencyTrendChart;
