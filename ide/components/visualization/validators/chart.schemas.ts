/**
 * @file: components/visualization/validators/chart.schemas.ts
 * @description: 图表数据 Zod 校验 Schemas (按可视化文档 §6 契约)
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-19
 * @updated: 2026-08-19
 * @status: active
 * @tags: [validator],[zod],[schema],[chart],[type-safety]
 *
 * brief: 所有图表组件入口数据必须经过对应 Zod Schema 校验
 *
 * details:
 * - 统一在 useChartData hook 中消费
 * - 失败时 fallback 为 []，页面不会崩溃，可显示空状态
 * - 通过 parse 得到的类型可直接给组件，不用再断言
 *
 * dependencies: zod
 * exports: TimeSeriesPointSchema, LineChartDataSchema, BarPointSchema,
 *          BarChartDataSchema, RadarAxisSchema, RadarSubjectSchema,
 *          RadarChartDataSchema, DonutPointSchema, DonutChartDataSchema
 */

import { z } from "zod";

// ==================================================================
// 1. 通用时序数据 (Line / Area)
// ==================================================================

/** 任何时序数据点必须满足的最小契约 */
export const TimeSeriesPointSchema = z
  .object({
    /** X 轴标签 (时间字符串或数字) */
    time: z.union([z.string(), z.number()]),
    /** 数据点显示名称 (Legend) */
    name: z.string().max(32).optional(),
    /** Y 轴数值；null/undefined → 自动转 0 */
    value: z.number().or(z.null().transform(() => 0)).or(z.undefined().transform(() => 0)),
    /** 语义状态标记 */
    status: z.enum(["success", "error", "warn", "warning", "idle"]).optional(),
    /** 原始时间戳 (用于 LTTB 排序，可选) */
    timestamp: z.number().optional(),
  })
  .passthrough(); // 允许附加字段透传给图表组件

export const LineChartDataSchema = z.array(TimeSeriesPointSchema).max(100_000);

/** 类型推断：时序点 & 折线图数据 */
export type TimeSeriesPoint = z.infer<typeof TimeSeriesPointSchema>;
export type LineChartData = z.infer<typeof LineChartDataSchema>;

// ==================================================================
// 2. 柱状图
// ==================================================================

export const BarPointSchema = z.object({
  label: z.string().max(64),
  value: z.number().min(0),
  color: z.string().regex(/^#[\da-fA-F]{3,8}$/).optional(),
  category: z.string().max(32).optional(),
});

export const BarChartDataSchema = z.array(BarPointSchema).max(1000);

/** 类型推断：柱状图 */
export type BarPoint = z.infer<typeof BarPointSchema>;
export type BarChartData = z.infer<typeof BarChartDataSchema>;

// ==================================================================
// 3. 雷达图 (核心 · 本任务交付主 schema)
// ==================================================================

/** 雷达图单一维度轴 */
export const RadarAxisSchema = z.object({
  /** 维度名，例如 "规划能力" */
  name: z.string().min(1).max(16),
  /** 该维度满分，默认 100 */
  fullMark: z.number().min(1).default(100),
  /** 可选：单位 (用于 Tooltip) */
  unit: z.string().max(8).optional(),
});

/** 雷达图单条数据 (8家族画像一条) */
export const RadarSubjectSchema = z.object({
  /** 主体名称 (Legend 用) */
  name: z.string().min(1).max(32),
  /** 每个轴的数值 (顺序必须与 axes 对齐) */
  values: z.array(z.number().min(0).or(z.null().transform(() => 0))),
  /** 可选：显式颜色，不填时从 familySeries 取色 */
  color: z.string().regex(/^#[\da-fA-F]{3,8}$/).optional(),
});

/** 雷达图完整数据 (Zod) */
export const RadarChartDataSchema = z.object({
  /** 轴维度定义 (必须 ≥3，否则无法构成雷达) */
  axes: z.array(RadarAxisSchema).min(3).max(16),
  /** 主体数据 (至少 1 条) */
  subjects: z.array(RadarSubjectSchema).min(1).max(8),
});

/** Radar 组件的最终安全类型 (inferred from schema) */
export type RadarAxis = z.infer<typeof RadarAxisSchema>;
export type RadarSubject = z.infer<typeof RadarSubjectSchema>;
export type RadarChartData = z.infer<typeof RadarChartDataSchema>;

// ==================================================================
// 4. 环形图
// ==================================================================

export const DonutPointSchema = z.object({
  name: z.string().max(32),
  value: z.number().min(0),
  color: z.string().regex(/^#[\da-fA-F]{3,8}$/).optional(),
});

export const DonutChartDataSchema = z.array(DonutPointSchema).min(1).max(32);

/** 类型推断：环形图 */
export type DonutPoint = z.infer<typeof DonutPointSchema>;
export type DonutChartData = z.infer<typeof DonutChartDataSchema>;
