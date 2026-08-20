/**
 * file: components/visualization/charts/RadarChart.tsx
 * description: 雷达图组件 · v2.0 (双主题 + Zod 校验 + §5 BaseChartProps 契约)
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v2.0.0
 * created: 2026-08-19
 * updated: 2026-08-19
 * status: active
 * tags: [component],[chart],[radar],[agent],[visualization],[theme]
 *
 * brief: 8 家族 Agent 六维能力画像雷达图 — 双主题切换 + Zod 校验 + §5 契约
 *
 * details:
 * v2.0 变更 (双主题体系):
 * - ✨ 接入 useVisualTheme() Hook — 动态 cyberpunk88/sunrise 令牌切换
 * - 🎨 所有颜色/尺寸/间距从 tokens 派生，无硬编码
 * - 🪂 无 Provider 静默降级 cyberpunk88 (向后兼容)
 * - 💾 8 家族 subjectColorMap: 亮色模式下使用 600~700 档高对比度色
 * - 🌈 SVG 渐变按当前主题 primary.400/600 取
 *
 * v1.x 能力 (保留):
 * - §5.1 BaseChartProps 契约完整实现
 * - §6 Zod schema (RadarChartDataSchema) 运行时校验
 * - 无数据 → 空状态；维度 <3 → 友好降级
 * - 主体条数 >8 → console.warn
 * - Tooltip: 主体/维度/数值/满分；a11y: role="region" + aria-label
 *
 * 典型场景: Agent 家族 6 维画像 / 模型能力雷达 / 候选人多维评分对比
 *
 * dependencies: react, recharts, zod,
 *               ../theme.ts, ../useVisualTheme.tsx,
 *               ../utils/chartUtils.ts, ../validators/chart.schemas.ts
 * exports: RadarChart (named + default)
 */

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  Radar,
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RTooltip,
  Legend as ReLegend,
} from "recharts";

// —— 主题: 按单一数据源原则从 useVisualTheme 读取 ——
import { useVisualTheme } from "../useVisualTheme";
import { makeChartGradId } from "../utils/chartUtils";

// —— Zod 契约类型 ——
import type { RadarChartData, RadarAxis, RadarSubject } from "../validators/chart.schemas";
import { RadarChartDataSchema } from "../validators/chart.schemas";

// ==================================================================
// 0. BaseChartProps 契约 (§5.1)
// ==================================================================

export interface RadarChartProps {
  /** 已标准化的雷达图数据 (axes + subjects) */
  data: RadarChartData;
  /** 画布高度 (px)，宽度由父容器 100% */
  height?: number;
  /** 是否显示 Tooltip — 默认 true */
  showTooltip?: boolean;
  /** 是否显示 Legend — 默认 true (多主体建议开启) */
  showLegend?: boolean;
  /** 内半径比例 (0~1) — 默认 0.1 */
  innerRadiusRatio?: number;
  /** 外半径比例 (0~1) — 默认 0.8 */
  outerRadiusRatio?: number;
  /** Tooltip 数值自定义格式化 */
  valueFormatter?: (
    value: number,
    axis: RadarAxis,
    subject: RadarSubject
  ) => ReactNode;
  /** 自定义空状态元素 */
  emptyState?: ReactNode;
  /** 额外 className (Tailwind) */
  className?: string;
  /** a11y: aria-label */
  ariaLabel?: string;
}

// ==================================================================
// 1. 内部工具函数
// ==================================================================

/**
 * 把 (axes + subjects) 扁平化成 Recharts Radar 要求的格式:
 *   [
 *     { axis: "规划", tianshu: 88, qianhang: 90, fullMark: 100 },
 *     { axis: "执行", tianshu: 70, qianhang: 80, fullMark: 100 },
 *     ...
 *   ]
 *
 * 边界兼容 (H8 修复):
 *  - subject.values 长度 < axes.length → 缺失位补 0
 *  - subject.values 长度 > axes.length → 截断，console.warn 一次
 *  - value 为 NaN / Infinity / -Infinity → 替换为 0 (避免 recharts SVG 异常)
 */
function transformToRecharts(data: RadarChartData): Array<Record<string, unknown>> {
  const { axes, subjects } = data;
  const axesLen = axes.length;

  // 长度不匹配检查（仅在 dev 环境 warn 一次，避免刷屏）
  if (typeof console !== "undefined") {
    subjects.forEach((s, si) => {
      const vLen = s.values?.length ?? 0;
      if (vLen !== axesLen) {
        const action = vLen < axesLen ? "右侧补 0" : "已截断多余值";
        // eslint-disable-next-line no-console
        console.warn(
          `[RadarChart] subject#${si} "${s.name}" values 长度 ${vLen} != axes ${axesLen}，${action}`
        );
      }
    });
  }

  return axes.map((axis, axisIdx) => {
    const row: Record<string, unknown> = {
      __axis: axis.name,
      axis: axis.name,
      fullMark: axis.fullMark ?? 100,
    };
    for (const subject of subjects) {
      const subjectKey = subject.name;
      const rawVal = (subject.values ?? [])[axisIdx];
      // 三重安全: null/undefined → 0 | NaN/非有限 → 0 | 负数 → 0 (雷达图不允许负)
      const numVal = typeof rawVal === "number" && Number.isFinite(rawVal) ? rawVal : 0;
      row[subjectKey] = Math.max(0, numVal);
    }
    return row;
  });
}

// ==================================================================
// 2. 主组件
// ==================================================================

export function RadarChart(props: RadarChartProps) {
  const {
    data,
    showTooltip = true,
    showLegend = true,
    innerRadiusRatio = 0.1,
    outerRadiusRatio = 0.8,
    valueFormatter,
    emptyState,
    className = "",
    ariaLabel,
  } = props;

  // —— v2.0: 从 Context 取当前主题 (单一数据源) ——
  const { tokens } = useVisualTheme();
  const height = props.height ?? tokens.size.md;

  // ---- (1) Zod 运行时校验 (按文档 §6 契约) ----
  const parseResult = useMemo(() => RadarChartDataSchema.safeParse(data), [data]);

  const validData: RadarChartData | null = parseResult.success ? parseResult.data : null;
  const validationErrors = parseResult.success ? null : parseResult.error;

  // ---- (2) 维度不足或校验失败 → 空状态 ----
  const isInvalid = !validData || validData.axes.length < 3 || validData.subjects.length === 0;

  if (isInvalid) {
    const reason = !validData
      ? "数据未通过 Zod 校验"
      : validData.axes.length < 3
      ? `雷达图至少需要 3 个维度 (当前 ${validData.axes.length})`
      : "主体数据为空";

    return (
      emptyState ?? (
        <div
          className={`flex items-center justify-center ${className}`}
          role="img"
          aria-label={ariaLabel ?? `雷达图无法显示: ${reason}`}
          style={{
            height,
            borderRadius: tokens.spacing.radius,
            border: `1px solid ${tokens.canvas.border}`,
            background: tokens.canvas.panel,
            padding: tokens.spacing.padding,
          }}
        >
          <div className="text-center">
            <p style={{ fontSize: 11, color: tokens.text.secondary, marginBottom: 6 }}>
              暂无法显示雷达图
            </p>
            <p style={{ fontSize: 9, color: tokens.text.disabled }}>{reason}</p>
            {validationErrors && (
              <details style={{ marginTop: 8, fontSize: 8, color: tokens.semantic.error + "AA" }}>
                <summary>Zod 校验详情</summary>
                <pre style={{ textAlign: "left", whiteSpace: "pre-wrap" }}>
                  {validationErrors.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    );
  }

  // ---- (3) 主体数量上限提醒 (8 家族刚好 8 条) ----
  if (validData.subjects.length > 8 && typeof console !== "undefined") {
    console.warn(
      `[RadarChart] 主体数量超过建议上限 8 (当前 ${validData.subjects.length})，颜色会循环，请考虑分组展示`
    );
  }

  // ---- (4) 转换 recharts 格式 ----
  const rechartsData = useMemo(() => transformToRecharts(validData), [validData]);

  // ---- (5) 为每个主体分配颜色 (优先用 subject.color，否则取 familySeries 循环) ----
  const subjectColorMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    const series = tokens.familySeries;
    validData.subjects.forEach((s, i) => {
      map[s.name] = s.color || series[i % series.length];
    });
    return map;
  }, [validData]);

  // ---- (6) SVG Gradient 唯一 ID (多个 Radar 同时展示避免冲突) ----
  const strokeGradId = useMemo(() => makeChartGradId("radar-stroke"), []);

  // ---- (7) Tooltip 定制 ----
  const tooltipContent = useMemo(() => {
    return function RadarTooltipContent(props: any) {
      const { active, payload, label } = props;
      if (!active || !payload || !payload.length) return null;
      const axis = validData.axes.find((a: any) => a.name === label);
      return (
        <div
          style={{
            background: tokens.canvas.bg,
            border: `1px solid ${tokens.canvas.border}`,
            borderRadius: 8,
            fontSize: 10,
            color: tokens.text.secondary,
            padding: 8,
            minWidth: 160,
          }}
        >
          <div
            style={{
              color: tokens.text.tertiary,
              fontSize: 9,
              marginBottom: 4,
              borderBottom: `1px dashed ${tokens.canvas.border}`,
              paddingBottom: 4,
            }}
          >
            维度：<strong style={{ color: tokens.text.primary }}>{label}</strong>
            {axis?.unit ? ` (${axis.unit})` : ""}
            {axis?.fullMark ? ` · 满分 ${axis.fullMark}` : ""}
          </div>
          {payload.map((entry: any, i: number) => {
            const subject = validData.subjects[i];
            if (!subject) return null;
            const rawVal = Number(entry.value);
            const color = subjectColorMap[entry.name] ?? tokens.primary[500];
            const valNode = valueFormatter
              ? valueFormatter(rawVal, axis, subject)
              : `${rawVal}${axis?.unit ?? ""}`;
            return (
              <div key={entry.name} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: color,
                    }}
                  />
                  <span>{entry.name}</span>
                </span>
                <span style={{ color }}>{valNode}</span>
              </div>
            );
          })}
        </div>
      );
    };
  }, [validData, subjectColorMap, valueFormatter]);

  // ---- (8) Legend 自定义 ----
  const legendContent = useMemo(() => {
    return function RadarLegendContent(props: any) {
      const { payload } = props;
      if (!payload?.length) return null;
      return (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 10px" }}>
          {payload.map((p: any, i: number) => (
            <div
              key={p.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9,
                color: tokens.text.secondary,
              }}
              title={validData.subjects[i]?.name}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: subjectColorMap[p.value] ?? tokens.primary[500],
                  opacity: 0.8,
                }}
              />
              <span>{p.value}</span>
            </div>
          ))}
        </div>
      );
    };
  }, [subjectColorMap, validData]);

  // ---- (9) 动画策略 (同 §7.2：主体 × 维度 > 200 点关闭) ----
  const totalCells = validData.axes.length * validData.subjects.length;
  const animation = totalCells <= 64;

  return (
    <div
      role="region"
      aria-label={
        ariaLabel ??
        `雷达图，${validData.axes.length} 个维度，${validData.subjects.length} 条主体对比`
      }
      className={className}
      style={{
        borderRadius: tokens.spacing.radius,
        border: `1px solid ${tokens.canvas.border}`,
        background: tokens.canvas.panel,
        padding: 16,
      }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ReRadarChart
            data={rechartsData}
            outerRadius={`${Math.round(outerRadiusRatio * 100)}%`}
            innerRadius={`${Math.round(innerRadiusRatio * 100)}%`}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            {/* SVG 定义：系列描边共用的渐变层 */}
            <defs>
              <linearGradient id={strokeGradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={tokens.primary[400]} stopOpacity={0.9} />
                <stop offset="100%" stopColor={tokens.primary[600]} stopOpacity={0.9} />
              </linearGradient>
            </defs>

            {/* 极坐标网格 */}
            <PolarGrid
              stroke={tokens.grid.stroke}
              strokeDasharray={tokens.grid.dashArray}
              radialLines={true}
            />

            {/* 角度轴 (维度名) */}
            <PolarAngleAxis
              dataKey="axis"
              tick={{
                fill: tokens.text.secondary,
                fontSize: 10,
                fontFamily: tokens.font.sans,
              }}
            />

            {/* 半径轴 (分数) */}
            <PolarRadiusAxis
              angle={30}
              domain={[0, "auto"]}
              tick={{
                fill: tokens.text.disabled,
                fontSize: 9,
                fontFamily: tokens.font.mono,
              }}
              axisLine={{ stroke: tokens.axis.stroke }}
            />

            {/* Tooltip */}
            {showTooltip && <RTooltip content={tooltipContent} />}

            {/* Legend */}
            {showLegend && (
              <ReLegend
                verticalAlign="bottom"
                height={28}
                iconSize={8}
                content={legendContent}
              />
            )}

            {/* 多主体多 Radar 层 */}
            {validData.subjects.map((subject, i) => {
              const color = subjectColorMap[subject.name];
              const key = `radar-${subject.name}-${i}`;
              return (
                <Radar
                  key={key}
                  name={subject.name}
                  dataKey={subject.name}
                  stroke={color}
                  strokeWidth={validData.subjects.length > 4 ? 1.2 : 1.6}
                  fill={color}
                  fillOpacity={Math.max(0.08, 0.28 - validData.subjects.length * 0.025)}
                  dot={{
                    fill: color,
                    r: 2,
                    stroke: tokens.canvas.bg,
                    strokeWidth: 1,
                  }}
                  activeDot={{
                    r: 3.5,
                    fill: color,
                    stroke: tokens.canvas.bg,
                    strokeWidth: 1.5,
                  }}
                  isAnimationActive={animation}
                />
              );
            })}
          </ReRadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default RadarChart;
