/**
 * @file: components/visualization/utils/chartUtils.ts
 * @description: 图表通用工具函数集合 (SVG Gradient ID / 单位格式化 / 空数据判断)
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-19
 * @updated: 2026-08-19
 * @status: active
 * @tags: [util],[chart],[svg],[helper]
 *
 * brief: 图表组件的通用工具集合，解决 SVG ID 冲突/格式化等共性问题
 *
 * details:
 * - makeChartGradId: 生成全页唯一的 SVG <linearGradient>/<radialGradient> ID
 *     解决同一页面存在多个 Area/Bar 图表时 ID 冲突导致 "串色" 的常见 Bug
 * - formatValueWithUnit: 数值单位智能格式化
 * - isEmptyChartData: 图表空数据判断
 *
 * dependencies: none (纯函数)
 * exports: makeChartGradId, formatValueWithUnit, isEmptyChartData
 */

// ==================================================================
// 1. SVG Gradient ID 唯一生成器
// ==================================================================

/** 全局自增序号 (进程内唯一) */
let __gradientSeqCounter = 0;

/**
 * 生成全页唯一的 SVG Gradient ID
 * 解决 Recharts 多实例 `<defs><linearGradient id="latencyGrad">` 重复定义导致的
 * "多个 Area 都用了相同 id → 所有 Area 都显示第一张的渐变颜色" Bug
 *
 * @param prefix 建议用图表类型前缀，如 "latency-area", "bar-success"
 * @example
 *   const id = makeChartGradId("latency");
 *   // 返回: "latency_area_q1kxyz_42"  (时间戳36进制 + 自增序号)
 */
export function makeChartGradId(prefix = "chart"): string {
  __gradientSeqCounter = (__gradientSeqCounter + 1) % 1_000_000;
  const ts = Date.now().toString(36); // 短时间戳
  const safePrefix = String(prefix).replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safePrefix}_${ts}_${__gradientSeqCounter}`;
}

// ==================================================================
// 2. 数值 + 单位格式化
// ==================================================================

export interface FormatValueOptions {
  /** 小数位数 (默认 0) */
  digits?: number;
  /** 千分位分隔 (默认 true) */
  thousandsSeparator?: boolean;
}

/**
 * 数值智能格式化 + 单位后缀
 *   999 → "999ms"
 *   2_345 → "2.3s"   (自动把 ms 转 s)
 *   1_234_567 → "1.2M token" (自动把大数字转 K/M/B)
 */
export function formatValueWithUnit(
  value: number | bigint | string | null | undefined,
  unit: "ms" | "bytes" | "token" | "%" | "count" = "count",
  opts: FormatValueOptions = {}
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";

  const { digits: digitsArg, thousandsSeparator = true } = opts;

  const sep = thousandsSeparator ? "," : "";
  const fmtIntl = (v: number, digits: number) =>
    v.toLocaleString("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
      useGrouping: thousandsSeparator,
    });

  // —— 时间: ms ——
  if (unit === "ms") {
    if (n < 1) return "< 1ms";
    if (n < 1000) return `${fmtIntl(n, 0)}ms`;
    return `${fmtIntl(n / 1000, digitsArg ?? 1)}s`;
  }

  // —— 数据量: bytes ——
  if (unit === "bytes") {
    if (n < 1024) return `${fmtIntl(n, 0)} B`;
    if (n < 1024 ** 2) return `${fmtIntl(n / 1024, digitsArg ?? 1)} KB`;
    if (n < 1024 ** 3) return `${fmtIntl(n / 1024 ** 2, digitsArg ?? 1)} MB`;
    return `${fmtIntl(n / 1024 ** 3, digitsArg ?? 2)} GB`;
  }

  // —— token 数量 / count 数字大单位 ——
  if (unit === "token" || unit === "count") {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000)
      return `${fmtIntl(n / 1_000_000_000, digitsArg ?? 2)}B${unit === "token" ? " token" : ""}`;
    if (abs >= 1_000_000)
      return `${fmtIntl(n / 1_000_000, digitsArg ?? 1)}M${unit === "token" ? " token" : ""}`;
    if (abs >= 1_000)
      return `${fmtIntl(n / 1_000, digitsArg ?? 1)}K${unit === "token" ? " token" : ""}`;
    return `${fmtIntl(n, digitsArg ?? 0)}${unit === "token" ? " token" : ""}`;
  }

  // —— 百分比 ——
  if (unit === "%") {
    return `${fmtIntl(n, digitsArg ?? 1)}%`;
  }

  return `${n}`;
}

// ==================================================================
// 3. 空数据判断
// ==================================================================

/**
 * 图表空数据判断
 *  - null / undefined → 空
 *  - 非数组 → 空 (类型保护)
 *  - length === 0 → 空
 *  - 所有行 dataKey 字段都为 null/undefined/NaN → 视为空
 */
export function isEmptyChartData(
  data: unknown,
  valueDataKey?: string
): data is null | undefined | [] {
  if (data == null) return true;
  if (!Array.isArray(data)) return true;
  if (data.length === 0) return true;
  if (valueDataKey) {
    const hasValid = data.some((row) => {
      if (row == null || typeof row !== "object") return false;
      const v = (row as Record<string, unknown>)[valueDataKey];
      if (typeof v === "number") return Number.isFinite(v);
      return v != null && v !== "";
    });
    return !hasValid;
  }
  return false;
}
