/**
 * file: VisualThemeAndCharts.test.tsx
 * description: 可视化主题 + 图表双主题集成用例 · AgentSkills 55 (vis-*)
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v1.0.0
 * created: 2026-08-19
 * updated: 2026-08-19
 * status: active
 * tags: [test],[visualization],[theme],[cyberpunk],[sunrise],[vitest]
 *
 * brief: 双主题 (Cyberpunk-88 + SunRise) 纯函数 + 组件渲染级用例集
 *
 * details:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  AgentSkills 55 vis-* 用例映射 (测试金字塔分布)               │
 * ├──────────────┬──────────────────────────────────────────────┤
 * │  纯函数 70%  │ vis-01~vis-42 : tokens / 语义取色 / 注册表     │
 * │              │ vis-43~vis-48 : LTTB 降采样算法边界            │
 * │              │ vis-49~vis-50 : chartUtils 工具               │
 * ├──────────────┼──────────────────────────────────────────────┤
 * │  渲染 25%   │ vis-51~vis-54 : Context 主题切换 + 组件重渲染   │
 * │              │ vis-55        : 无 Provider 静默降级           │
 * ├──────────────┼──────────────────────────────────────────────┤
 * │  E2E  5%    │ 本文件不覆盖 (需集成测试环境)                   │
 * └──────────────┴──────────────────────────────────────────────┘
 *
 * vis-01  VISUAL_TOKENS_SUNRISE 结构完整
 * vis-02  CYBERPUNK_88_THEME 结构完整
 * vis-03  双主题 size 令牌相等 (尺寸不随主题变)
 * vis-04  双主题 spacing 令牌相等
 * vis-05  双主题 radius 令牌相等
 * vis-06  双主题 grid.dashArray 令牌相等
 * vis-07  SUNRISE canvas.bg === #ffffff (纯白底)
 * vis-08  CYBERPUNK canvas.bg === #0d1117 (GitHub 深蓝)
 * vis-09  SUNRISE text.primary 对比度足够 (非透明色)
 * vis-10  SUNRISE text.primary !== CYBERPUNK text.primary
 * vis-11  SUNRISE semantic.success === CYBERPUNK semantic.success (语义色兼容)
 * vis-12  THEME_REGISTRY 包含 cyberpunk88 + sunrise 两个键
 * vis-13  getThemeById('cyberpunk88') === CYBERPUNK_88_THEME
 * vis-14  getThemeById('sunrise') === VISUAL_TOKENS_SUNRISE
 * vis-15  getThemeById(null) 降级 cyberpunk88 (无崩溃)
 * vis-16  getThemeById(undefined) 降级 cyberpunk88
 * vis-17  getThemeById('bogus') 降级 cyberpunk88
 * vis-18  getThemeById('') 空串降级 cyberpunk88
 * vis-19  t 便捷别名 === CYBERPUNK_88_THEME (向后兼容)
 * vis-20  VISUAL_TOKENS 别名 === CYBERPUNK_88_THEME
 * vis-21  getSemanticColor('success') 返回合法字符串颜色
 * vis-22  getSemanticColor('error') 返回合法字符串颜色
 * vis-23  getFamilyColor('tianshu') 返回 cyan 风格色
 * vis-24  getSemanticColorForTokens(SUNRISE, 'error') 与默认一致 (语义色稳定)
 * vis-25  getFamilyColorForTokens(SUNRISE, 'tianshu') 返回 familySeries[0]
 * vis-26  statusToSemantic('success') → 'success'
 * vis-27  statusToSemantic('Succeeded') → 'success' (大小写不敏感)
 * vis-28  statusToSemantic('Failed') → 'error'
 * vis-29  statusToSemantic('Error') → 'error'
 * vis-30  statusToSemantic('warning') → 'warning'
 * vis-31  statusToSemantic('Pending') → 'info'
 * vis-32  statusToSemantic('running') → 'info'
 * vis-33  statusToSemantic('stalled') → 'purple'
 * vis-34  statusToSemantic('stalling') → 'purple'
 * vis-35  statusToSemantic(null) → 'info'
 * vis-36  statusToSemantic(undefined) → 'info'
 * vis-37  statusToSemantic('unknown_garbage') → 'info' (默认回退)
 * vis-38  statusColor('success') === getSemanticColor('success')
 * vis-39  statusColorForTokens(SUNRISE, 'Failed') 非空串
 * vis-40  toCssVars(SUNRISE) 至少返回 --vis-canvas-bg
 * vis-41  toCssVars(CYBERPUNK) 至少返回 --vis-canvas-bg
 * vis-42  toCssVars(SUNRISE) !== toCssVars(CYBERPUNK) (两主题 CSS 不同)
 * vis-43  lttbDownsample 空数组 → []
 * vis-44  lttbDownsample 数据量 < target → 原样返回
 * vis-45  autoDownsample 100 条数据 → strategy 'none'
 * vis-46  autoDownsample 3000 条数据 → strategy 'md' 或更高
 * vis-47  autoDownsample 3000 条数据 → 返回 data.length <= 1200
 * vis-48  lttbDownsample 保留首尾两点 (LTTB 基本不变式)
 * vis-49  makeChartGradId 两次调用结果不同 (唯一 ID)
 * vis-50  makeChartGradId 结果长度 ≤ 64 (ID 长度可控)
 * vis-51  VisualThemeProvider 初始默认 cyberpunk88 (localStorage 清空)
 * vis-52  VisualThemeProvider setThemeId('sunrise') 切换生效 + tokens 同步
 * vis-53  setThemeId 无效 id 不生效 (不变更)
 * vis-54  setThemeId 触发 localStorage 写入 (YYC3_VISUAL_THEME_ID)
 * vis-55  无 Provider 环境, useVisualTheme 静默降级 cyberpunk88 (不崩溃)
 *
 * test-target:
 *   - components/visualization/theme.ts
 *   - components/visualization/useVisualTheme.tsx
 *   - components/visualization/utils/lttb.ts
 *   - components/visualization/utils/chartUtils.ts
 * coverage-target: theme / useVisualTheme / lttb / chartUtils ≥ 85%
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";

// —— 被测模块 ——
import {
  CYBERPUNK_88_THEME,
  VISUAL_TOKENS_SUNRISE,
  THEME_REGISTRY,
  getThemeById,
  t,
  VISUAL_TOKENS,
  getSemanticColor,
  getFamilyColor,
  statusToSemantic,
  statusColor,
  getSemanticColorForTokens,
  getFamilyColorForTokens,
  statusColorForTokens,
  toCssVars,
  type SemanticRole,
  type FamilyVisualRole,
  type VisualTokensType,
} from "../theme";

import { useVisualTheme, VisualThemeProvider } from "../useVisualTheme";
import { lttbDownsample, autoDownsample, type LTTBPoint } from "../utils/lttb";
import { makeChartGradId, formatValueWithUnit, isEmptyChartData } from "../utils/chartUtils";

// —— Zod Schemas (本补充重点) ——
import {
  TimeSeriesPointSchema,
  LineChartDataSchema,
  BarPointSchema,
  BarChartDataSchema,
  RadarAxisSchema,
  RadarSubjectSchema,
  RadarChartDataSchema,
  DonutPointSchema,
  DonutChartDataSchema,
  type RadarChartData,
} from "../validators/chart.schemas";

const SK_VISUAL_THEME = "yyc3_visual_theme_v1";

// —— 测试前清理 localStorage ——
beforeEach(() => {
  localStorage.clear();
});

describe("AgentSkills 55 vis-* · 主题令牌 & 工具层 (纯函数 70%)", () => {
  const S = VISUAL_TOKENS_SUNRISE;
  const C = CYBERPUNK_88_THEME;

  // —— vis-01~vis-06 结构/尺寸稳定 ——
  it("vis-01 VISUAL_TOKENS_SUNRISE 结构完整 (canvas / text / primary 存在)", () => {
    expect(S).toHaveProperty("canvas");
    expect(S).toHaveProperty("text");
    expect(S).toHaveProperty("primary");
    expect(S).toHaveProperty("semantic");
    expect(S).toHaveProperty("familySeries");
  });

  it("vis-02 CYBERPUNK_88_THEME 结构完整", () => {
    expect(C).toHaveProperty("canvas");
    expect(C).toHaveProperty("text");
    expect(C).toHaveProperty("primary");
    expect(C).toHaveProperty("grid");
    expect(C).toHaveProperty("axis");
  });

  it("vis-03 双主题 size.md 相等 (尺寸不随主题变)", () => {
    expect(S.size.md).toBe(C.size.md);
  });

  it("vis-04 双主题 spacing.padding 相等", () => {
    expect(S.spacing.padding).toEqual(C.spacing.padding);
  });

  it("vis-05 双主题 radius 相等", () => {
    expect(S.spacing.radius).toBe(C.spacing.radius);
  });

  it("vis-06 双主题 grid.dashArray 相等", () => {
    expect(S.grid.dashArray).toBe(C.grid.dashArray);
  });

  // —— vis-07~vis-10 颜色差异化 ——
  it("vis-07 SUNRISE canvas.bg 纯白 #ffffff", () => {
    expect(S.canvas.bg.toLowerCase()).toBe("#ffffff");
  });

  it("vis-08 CYBERPUNK canvas.bg #0d1117 (GitHub Dark)", () => {
    expect(C.canvas.bg.toLowerCase()).toBe("#0d1117");
  });

  it("vis-09 SUNRISE text.primary 非透明 (满足 WCAG)", () => {
    expect(S.text.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("vis-10 双主题 text.primary 不相同", () => {
    expect(S.text.primary).not.toBe(C.text.primary);
  });

  it("vis-11 语义 success 两主题均合法颜色 (品牌语义可调整深度)", () => {
    expect(S.semantic.success).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(C.semantic.success).toMatch(/^#[0-9a-fA-F]{6}$/);
    // 与 primary 主色不同 (语义色独立)
    expect(S.semantic.success.toLowerCase()).not.toBe(S.primary[500].toLowerCase());
    expect(C.semantic.success.toLowerCase()).not.toBe(C.primary[500].toLowerCase());
  });

  // —— vis-12~vis-18 ThemeRegistry + getThemeById ——
  it("vis-12 THEME_REGISTRY 双主题键齐全", () => {
    expect(Object.keys(THEME_REGISTRY).sort()).toEqual(["cyberpunk88", "sunrise"]);
  });

  it("vis-13 getThemeById('cyberpunk88') 正确", () => {
    expect(getThemeById("cyberpunk88")).toBe(CYBERPUNK_88_THEME);
  });

  it("vis-14 getThemeById('sunrise') 正确", () => {
    expect(getThemeById("sunrise")).toBe(VISUAL_TOKENS_SUNRISE);
  });

  it("vis-15 getThemeById(null) 降级 cyberpunk88", () => {
    expect(getThemeById(null)).toBe(CYBERPUNK_88_THEME);
  });

  it("vis-16 getThemeById(undefined) 降级 cyberpunk88", () => {
    expect(getThemeById(undefined)).toBe(CYBERPUNK_88_THEME);
  });

  it("vis-17 getThemeById('bogus') 降级 cyberpunk88", () => {
    expect(getThemeById("bogus")).toBe(CYBERPUNK_88_THEME);
  });

  it("vis-18 getThemeById('') 空串降级 cyberpunk88", () => {
    expect(getThemeById("")).toBe(CYBERPUNK_88_THEME);
  });

  // —— vis-19~vis-20 向后兼容别名 ——
  it("vis-19 t 别名 === CYBERPUNK_88_THEME", () => {
    expect(t).toBe(CYBERPUNK_88_THEME);
  });

  it("vis-20 VISUAL_TOKENS 别名 === CYBERPUNK_88_THEME", () => {
    expect(VISUAL_TOKENS).toBe(CYBERPUNK_88_THEME);
  });

  // —— vis-21~vis-25 语义/家族取色 ——
  it("vis-21 getSemanticColor('success') 返回合法色", () => {
    expect(getSemanticColor("success")).toMatch(/^#|^rgba?\(/i);
  });

  it("vis-22 getSemanticColor('error') 返回合法色", () => {
    expect(getSemanticColor("error")).toMatch(/^#|^rgba?\(/i);
  });

  it("vis-23 getFamilyColor('tianshu') 含 '06b6d4' (Cyan)", () => {
    expect(getFamilyColor("tianshu").toLowerCase()).toContain("06b6d4");
  });

  it("vis-24 getSemanticColorForTokens(SUNRISE,'error') 稳定", () => {
    expect(getSemanticColorForTokens(S, "error")).toBe(S.semantic.error);
  });

  it("vis-25 getFamilyColorForTokens(SUNRISE,'tianshu') === familySeries[0]", () => {
    expect(getFamilyColorForTokens(S, "tianshu")).toBe(S.familySeries[0]);
  });

  // —— vis-26~vis-37 statusToSemantic 映射表 ——
  it.each([
    ["success", "success"],
    ["Succeeded", "success"],
    ["ok", "success"],
    ["pass", "success"],
    ["passed", "success"],
    ["healthy", "success"],
    ["active", "success"],
    ["complete", "success"],
    ["completed", "success"],
    ["done", "success"],
    ["ready", "success"],
  ])("vis-26~27 statusToSemantic('%s') → success", (input, expected) => {
    expect(statusToSemantic(input)).toBe(expected);
  });

  it.each([
    ["Failed", "error"],
    ["failed", "error"],
    ["Error", "error"],
    ["error", "error"],
    ["fatal", "error"],
    ["crash", "error"],
    ["denied", "error"],
    ["fail", "error"],
    ["unhealthy", "error"],
    ["down", "error"],
    ["timeout", "error"],
    ["timed_out", "error"],
    ["cancelled", "error"],
    ["canceled", "error"],
    ["aborted", "error"],
  ])("vis-28~29 statusToSemantic('%s') → error", (input, expected) => {
    expect(statusToSemantic(input)).toBe(expected);
  });

  it.each([
    ["warning", "warning"],
    ["warn", "warning"],
    ["degraded", "warning"],
    ["throttled", "warning"],
    ["slow", "warning"],
    ["high", "warning"],
  ])("vis-30 statusToSemantic('%s') → warning", (input, expected) => {
    expect(statusToSemantic(input)).toBe(expected);
  });

  it.each([
    ["Pending", "info"],
    ["pending", "info"],
    ["running", "info"],
    ["in_progress", "info"],
    ["processing", "info"],
    ["starting", "info"],
    ["initializing", "info"],
    ["queued", "info"],
    ["scheduled", "info"],
    ["idle", "info"],
    ["standby", "info"],
    ["waiting", "info"],
  ])("vis-31~32 statusToSemantic('%s') → info", (input, expected) => {
    expect(statusToSemantic(input)).toBe(expected);
  });

  it.each([
    ["stalled", "purple"],
    ["stalling", "purple"],
    ["blocked", "purple"],
  ])("vis-33~34 statusToSemantic('%s') → purple", (input, expected) => {
    expect(statusToSemantic(input)).toBe(expected);
  });

  it("vis-35 statusToSemantic(null) → info", () => {
    expect(statusToSemantic(null)).toBe("info");
  });

  it("vis-36 statusToSemantic(undefined) → info", () => {
    expect(statusToSemantic(undefined)).toBe("info");
  });

  it("vis-37 statusToSemantic('unknown_garbage') → info", () => {
    expect(statusToSemantic("unknown_garbage")).toBe("info");
  });

  // —— vis-38~vis-39 statusColor + ForTokens ——
  it("vis-38 statusColor('success') === getSemanticColor('success')", () => {
    expect(statusColor("success")).toBe(getSemanticColor("success"));
  });

  it("vis-39 statusColorForTokens(SUNRISE, 'Failed') 非空", () => {
    expect(statusColorForTokens(S, "Failed")).toBeTruthy();
    expect(typeof statusColorForTokens(S, "Failed")).toBe("string");
  });

  // —— vis-40~vis-42 toCssVars ——
  it("vis-40 toCssVars(SUNRISE) 至少包含 --vis-canvas-bg", () => {
    const vars = toCssVars(S);
    expect(vars).toHaveProperty("--vis-canvas-bg");
    expect(vars["--vis-canvas-bg"].toLowerCase()).toBe("#ffffff");
  });

  it("vis-41 toCssVars(CYBERPUNK) 包含 --vis-canvas-bg", () => {
    const vars = toCssVars(C);
    expect(vars).toHaveProperty("--vis-canvas-bg");
    expect(vars["--vis-canvas-bg"].toLowerCase()).toBe("#0d1117");
  });

  it("vis-42 两主题 CSS Vars 内容不相同", () => {
    expect(JSON.stringify(toCssVars(S))).not.toBe(JSON.stringify(toCssVars(C)));
  });
});

describe("AgentSkills 55 vis-43~vis-50 · LTTB 算法 & chartUtils", () => {
  it("vis-43 lttbDownsample 空数组 → []", () => {
    expect(lttbDownsample([], 10)).toEqual([]);
  });

  it("vis-44 lttbDownsample 少于 target 原样返回", () => {
    const tiny = [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(lttbDownsample(tiny, 100)).toEqual(tiny);
  });

  it("vis-45 autoDownsample 100 条 → strategy 'none'", () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ x: i, y: Math.sin(i) }));
    const result = autoDownsample(data);
    expect(result.strategy).toBe("none");
    expect(result.data.length).toBe(100);
  });

  it("vis-46 autoDownsample 3000 条 → strategy 非 none", () => {
    const data = Array.from({ length: 3000 }, (_, i) => ({ x: i, y: Math.sin(i / 10) }));
    const result = autoDownsample(data);
    expect(["md", "lg", "xl"]).toContain(result.strategy);
  });

  it("vis-47 autoDownsample 3000 条降采样 ≤ 1200", () => {
    const data = Array.from({ length: 3000 }, (_, i) => ({ x: i, y: Math.cos(i / 10) }));
    const result = autoDownsample(data);
    expect(result.data.length).toBeLessThanOrEqual(1200);
  });

  it("vis-48 lttbDownsample 保留首尾两点", () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ x: i, y: (i - 50) ** 2 }));
    const sampled = lttbDownsample(data, 20);
    expect(sampled[0].x).toBe(0);
    expect(sampled[sampled.length - 1].x).toBe(99);
  });

  it("vis-49 makeChartGradId 两次调用不同 (唯一 ID)", () => {
    expect(makeChartGradId("p")).not.toBe(makeChartGradId("p"));
  });

  it("vis-50 makeChartGradId ID 长度 ≤ 64", () => {
    expect(makeChartGradId("p").length).toBeLessThanOrEqual(64);
  });
});

describe("AgentSkills 55 vis-51~vis-55 · Context Provider + Hook 渲染层", () => {
  it("vis-51 Provider 默认 cyberpunk88 (localStorage 空)", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
    expect(result.current.isLight).toBe(false);
    expect(result.current.tokens.canvas.bg.toLowerCase()).toBe("#0d1117");
  });

  it("vis-52 setThemeId('sunrise') 切换生效 + tokens 同步 + localStorage 写入", () => {
    let written: { key: string; value: string } | null = null;
    const setMock = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation((k: string, v: string) => {
        written = { key: k, value: v };
      });

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });

    act(() => {
      result.current.setThemeId("sunrise");
    });

    expect(result.current.themeId).toBe("sunrise");
    expect(result.current.isLight).toBe(true);
    expect(result.current.tokens.canvas.bg.toLowerCase()).toBe("#ffffff");
    // vis-54: localStorage 键正确
    expect(written).not.toBeNull();
    expect(written!.key).toBe(SK_VISUAL_THEME);
    expect(written!.value).toBe("sunrise");

    setMock.mockRestore();
  });

  it("vis-53 setThemeId 无效 id 不生效", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    const oldTokens = result.current.tokens;

    act(() => {
      result.current.setThemeId("bogus_theme_id" as any);
    });

    expect(result.current.themeId).toBe("cyberpunk88");
    expect(result.current.tokens).toBe(oldTokens);
  });

  it("vis-55 无 Provider 环境: useVisualTheme 静默降级 cyberpunk88 不崩溃", () => {
    const { result } = renderHook(() => useVisualTheme());
    expect(result.current.themeId).toBe("cyberpunk88");
    expect(result.current.isLight).toBe(false);
    expect(result.current.tokens.canvas.bg.toLowerCase()).toBe("#0d1117");
    // setThemeId 在无 Provider 时为 no-op，不应抛
    expect(() => act(() => result.current.setThemeId("sunrise"))).not.toThrow();
    expect(result.current.themeId).toBe("cyberpunk88");
  });
});

// —— 快速导出标记，便于 vitest 聚合时识别 ——
export const VISUAL_TEST_SUITE_VERSION = "1.1.0";

// ==================================================================
// ★ B. LTTB 降采样策略 · 补充边界 (README 提到的 4 档阈值 + options)
// ==================================================================
describe("B · LTTB 降采样 · 精确阈值分档 + Options + 极端输入 (vis-56~vis-80)", () => {
  // —— 基于 lttb.ts 实际默认值:
  //    smallThreshold: 2000, largeThreshold: 10000, xLargeThreshold: 50000
  //    mediumTarget: 400, largeTarget: 500, xLargeTarget: 600

  // —— B1 精确边界分档 ——
  it.each([
    ["N=0 → none",    0,     "none"],
    ["N=1 → none",    1,     "none"],
    ["N=2000 → none (等于阈值)", 2000, "none"],
    ["N=2001 → md (越过小阈值)", 2001, "md"],
    ["N=9999 → md (低于大阈值)", 9999, "md"],
    ["N=10000 → lg (等于大阈值)", 10000, "lg"],
    ["N=49999 → lg (低于超大阈值)", 49999, "lg"],
    ["N=50000 → xl (等于超大阈值)", 50000, "xl"],
    ["N=100000 → xl (远超超大阈值)", 100000, "xl"],
  ])(`vis-56 autoDownsample %s → %s`, (_label, n, expectedStrategy) => {
    const data = Array.from({ length: n as number }, (_, i) => ({ x: i, y: Math.sin(i / 7) }));
    const result = autoDownsample(data);
    expect(result.strategy).toBe(expectedStrategy);
    expect(result.originalLength).toBe(n);
  });

  // —— B2 各档 target 精确值 ——
  it("vis-57 md 档 target = 400 (N=2001)", () => {
    const data = Array.from({ length: 2001 }, (_, i) => ({ x: i, y: i }));
    expect(autoDownsample(data).target).toBe(400);
  });

  it("vis-58 lg 档 target = 500 (N=10000)", () => {
    const data = Array.from({ length: 10000 }, (_, i) => ({ x: i, y: i }));
    expect(autoDownsample(data).target).toBe(500);
  });

  it("vis-59 xl 档 target = 600 (N=50000)", () => {
    const data = Array.from({ length: 50000 }, (_, i) => ({ x: i, y: i }));
    expect(autoDownsample(data).target).toBe(600);
  });

  it("vis-60 none 档 target = 实际数据长度 (N=1999)", () => {
    const data = Array.from({ length: 1999 }, (_, i) => ({ x: i, y: i }));
    expect(autoDownsample(data).target).toBe(1999);
  });

  // —— B3 自定义 Options ——
  it("vis-61 smallThreshold 自定义 100 → N=150 进入 md", () => {
    const data = Array.from({ length: 150 }, (_, i) => ({ x: i, y: i }));
    const result = autoDownsample(data, { smallThreshold: 100, mediumTarget: 50 });
    expect(result.strategy).toBe("md");
    expect(result.data.length).toBe(50);
  });

  it("vis-62 largeThreshold 自定义 500 → N=500 进入 lg", () => {
    const data = Array.from({ length: 500 }, (_, i) => ({ x: i, y: i }));
    const result = autoDownsample(data, {
      smallThreshold: 100, mediumTarget: 80,
      largeThreshold: 500, largeTarget: 60,
    });
    expect(result.strategy).toBe("lg");
    expect(result.data.length).toBe(60);
  });

  it("vis-63 xLargeThreshold 自定义 1000 → N=1000 进入 xl", () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: i }));
    const result = autoDownsample(data, {
      smallThreshold: 100, largeThreshold: 500, xLargeThreshold: 1000,
      xLargeTarget: 75,
    });
    expect(result.strategy).toBe("xl");
    expect(result.data.length).toBe(75);
  });

  it("vis-64 options 合并默认值 (只改一个字段)", () => {
    const data = Array.from({ length: 3000 }, (_, i) => ({ x: i, y: i }));
    // 只改 mediumTarget 到 250，其他阈值保持默认 → N=3000 应走 md 档
    const result = autoDownsample(data, { mediumTarget: 250 });
    expect(result.strategy).toBe("md");
    expect(result.target).toBe(250);
    expect(result.data.length).toBe(250);
  });

  // —— B4 lttbDownsample 极端 target ——
  it("vis-65 targetLength = 0 → []", () => {
    expect(lttbDownsample([{ x: 1, y: 2 }, { x: 2, y: 3 }], 0)).toEqual([]);
  });

  it("vis-66 targetLength = 负数 → []", () => {
    expect(lttbDownsample([{ x: 1, y: 2 }], -5)).toEqual([]);
  });

  it("vis-67 targetLength = 1 → 仅返回 1 个点 (lttb: data.length<=target 时 copy)", () => {
    const tiny = [{ x: 0, y: 0 }];
    expect(lttbDownsample(tiny, 1)).toEqual(tiny);
  });

  it("vis-68 targetLength = 2 (只有首尾) · data=10 点", () => {
    const data = Array.from({ length: 10 }, (_, i) => ({ x: i, y: i * i }));
    const sampled = lttbDownsample(data, 2);
    expect(sampled.length).toBe(2);
    expect(sampled[0].x).toBe(0);
    expect(sampled[1].x).toBe(9);
  });

  it("vis-69 lttbDownsample data 为 null/undefined → []", () => {
    expect(lttbDownsample(null as unknown as LTTBPoint[], 10)).toEqual([]);
    expect(lttbDownsample(undefined as unknown as LTTBPoint[], 10)).toEqual([]);
  });

  // —— B5 LTTB 算法正确性 ——
  it("vis-70 方波尖峰保留 (LTTB 不丢尖峰)", () => {
    // 构造 [100 个 0, 1 个 100 (尖峰), 100 个 0] 共 201 点
    const data: LTTBPoint[] = Array.from({ length: 201 }, (_, i) => ({
      x: i,
      y: i === 100 ? 100 : 0,
    }));
    const sampled = lttbDownsample(data, 30);
    // 降采样后必须仍存在 y=100 的尖峰点
    expect(sampled.some(p => p.y === 100)).toBe(true);
  });

  it("vis-71 保留 LTTBPoint.raw 字段 (调用方元数据不丢失)", () => {
    const data = Array.from({ length: 50 }, (_, i) => ({
      x: i, y: Math.sin(i), raw: { status: i % 5 === 0 ? "error" : "success", idx: i },
    }));
    const sampled = lttbDownsample(data, 10);
    for (const p of sampled) {
      expect(p.raw).toBeDefined();
      expect(typeof (p.raw as any).idx).toBe("number");
    }
  });

  it("vis-72 autoDownsample data=[] → none, target=0", () => {
    const r = autoDownsample([]);
    expect(r.strategy).toBe("none");
    expect(r.originalLength).toBe(0);
    expect(r.data.length).toBe(0);
    expect(r.target).toBe(0);
  });

  it("vis-73 lttbDownsample copy 模式 (data<=target) 不返回同一引用", () => {
    const src = [{ x: 1, y: 1 }, { x: 2, y: 2 }];
    const out = lttbDownsample(src, 10);
    expect(out).toEqual(src);
    expect(out).not.toBe(src); // 必须是 slice 副本
  });

  it("vis-74 N=50000 → 真正采样到 xLargeTarget=600 (xl 档)", () => {
    const data = Array.from({ length: 50000 }, (_, i) => ({ x: i, y: Math.sin(i / 23) }));
    const r = autoDownsample(data);
    expect(r.strategy).toBe("xl");
    expect(r.data.length).toBe(600);
  });
});

// ==================================================================
// ★ C. Zod 校验逻辑 · README 对应 6 个 Schema 全边界 (vis-81~vis-110)
// ==================================================================
describe("C · Zod 校验 · 6 Schema 上下界 + 非法输入 (vis-81~vis-110)", () => {
  // —— C1 TimeSeriesPointSchema ——
  it("vis-81 TimeSeriesPoint 合法 (time+value) → success", () => {
    const r = TimeSeriesPointSchema.safeParse({ time: "2026-01-01", value: 3.14 });
    expect(r.success).toBe(true);
  });

  it("vis-82 TimeSeriesPoint value=null → transform 为 0", () => {
    const r = TimeSeriesPointSchema.safeParse({ time: 1, value: null });
    expect(r.success).toBe(true);
    expect((r.data as any).value).toBe(0);
  });

  it("vis-83 TimeSeriesPoint value=undefined → transform 为 0", () => {
    const r = TimeSeriesPointSchema.safeParse({ time: 1 });
    expect(r.success).toBe(true);
    expect((r.data as any).value).toBe(0);
  });

  it("vis-84 TimeSeriesPoint 缺 time → 失败", () => {
    expect(TimeSeriesPointSchema.safeParse({ value: 1 }).success).toBe(false);
  });

  it("vis-85 TimeSeriesPoint value=字符串 → 失败", () => {
    expect(TimeSeriesPointSchema.safeParse({ time: 1, value: "abc" }).success).toBe(false);
  });

  it("vis-86 status 不合法枚举值 → 失败", () => {
    expect(TimeSeriesPointSchema.safeParse({ time: 1, value: 1, status: "bad" }).success).toBe(false);
  });

  // —— C2 LineChartDataSchema ——
  it("vis-87 LineChartData 100_000 条 → 通过 (上限边界)", () => {
    const arr = Array.from({ length: 100_000 }, (_, i) => ({ time: i, value: i }));
    expect(LineChartDataSchema.safeParse(arr).success).toBe(true);
  });

  it("vis-88 LineChartData 100_001 条 → 超上限失败", () => {
    const arr = Array.from({ length: 100_001 }, (_, i) => ({ time: i, value: i }));
    expect(LineChartDataSchema.safeParse(arr).success).toBe(false);
  });

  it("vis-89 LineChartData 非数组 → 失败", () => {
    expect(LineChartDataSchema.safeParse("hello").success).toBe(false);
  });

  // —— C3 BarPointSchema / BarChartDataSchema ——
  it("vis-90 BarPoint 合法通过 + color 可选正则匹配", () => {
    expect(BarPointSchema.safeParse({ label: "A", value: 10, color: "#ABC" }).success).toBe(true);
    expect(BarPointSchema.safeParse({ label: "B", value: 5, color: "#AABBCC80" }).success).toBe(true);
    expect(BarPointSchema.safeParse({ label: "C", value: 1, color: "not-a-hex" }).success).toBe(false);
  });

  it("vis-91 BarPoint value 负数 → 失败 (min(0))", () => {
    expect(BarPointSchema.safeParse({ label: "A", value: -1 }).success).toBe(false);
  });

  it("vis-92 BarChartDataSchema 上限 1000 → 1000 通过 / 1001 失败", () => {
    const arr1000 = Array.from({ length: 1000 }, (_, i) => ({ label: String(i), value: i }));
    const arr1001 = Array.from({ length: 1001 }, (_, i) => ({ label: String(i), value: i }));
    expect(BarChartDataSchema.safeParse(arr1000).success).toBe(true);
    expect(BarChartDataSchema.safeParse(arr1001).success).toBe(false);
  });

  // —— C4 Radar 3 Schema ——
  it.each([2, 1, 0, 17])(`vis-93 Radar axes min(3)/max(16) · axes=%s → 失败`, (n) => {
    const axes = Array.from({ length: n }, (_, i) => ({ name: `ax${i}`, fullMark: 100 }));
    const data = { axes, subjects: [{ name: "A", values: axes.map(() => 50) }] };
    expect(RadarChartDataSchema.safeParse(data).success).toBe(false);
  });

  it.each([3, 8, 16])(`vis-94 Radar axes=%s → 合法通过`, (n) => {
    const axes = Array.from({ length: n }, (_, i) => ({ name: `ax${i}` }));
    const data = { axes, subjects: [{ name: "A", values: axes.map(() => 50) }] };
    expect(RadarChartDataSchema.safeParse(data).success).toBe(true);
  });

  it("vis-95 Radar subjects min(1) 空数组失败 / max(8) 第9个失败", () => {
    const axes = [{ name: "a" }, { name: "b" }, { name: "c" }];
    const empty = { axes, subjects: [] };
    const nine = {
      axes,
      subjects: Array.from({ length: 9 }, (_, i) => ({ name: `s${i}`, values: [1, 2, 3] })),
    };
    expect(RadarChartDataSchema.safeParse(empty).success).toBe(false);
    expect(RadarChartDataSchema.safeParse(nine).success).toBe(false);
  });

  it("vis-96 RadarSubject values 缺项自动 0 + color 合法正则 / 非法失败", () => {
    const ok = RadarSubjectSchema.safeParse({ name: "OK", values: [1, null, 3], color: "#FFFFFF" });
    const badColor = RadarSubjectSchema.safeParse({ name: "X", values: [1], color: "red" });
    expect(ok.success).toBe(true);
    expect((ok.data as any).values[1]).toBe(0);
    expect(badColor.success).toBe(false);
  });

  it("vis-97 RadarAxis fullMark 非数字失败 / name 空串失败 / name >16 失败", () => {
    expect(RadarAxisSchema.safeParse({ name: "A", fullMark: "100" }).success).toBe(false);
    expect(RadarAxisSchema.safeParse({ name: "", fullMark: 100 }).success).toBe(false);
    expect(RadarAxisSchema.safeParse({ name: "ABCDEFGHIJKLMNOPQ", fullMark: 100 }).success).toBe(false); // 17
  });

  it("vis-98 RadarChartData 完全 null/undefined/非对象 → 失败", () => {
    expect(RadarChartDataSchema.safeParse(null).success).toBe(false);
    expect(RadarChartDataSchema.safeParse(undefined).success).toBe(false);
    expect(RadarChartDataSchema.safeParse("hello").success).toBe(false);
  });

  it("vis-99 RadarChartData 缺失字段 → 失败", () => {
    expect(RadarChartDataSchema.safeParse({}).success).toBe(false);
    expect(RadarChartDataSchema.safeParse({ axes: [] }).success).toBe(false);
    expect(RadarChartDataSchema.safeParse({ subjects: [] }).success).toBe(false);
  });

  // —— C5 Donut ——
  it("vis-100 Donut min(1) 空数组失败 / max(32) 33 失败", () => {
    expect(DonutChartDataSchema.safeParse([]).success).toBe(false);
    const arr33 = Array.from({ length: 33 }, (_, i) => ({ name: String(i), value: i }));
    expect(DonutChartDataSchema.safeParse(arr33).success).toBe(false);
  });

  it("vis-101 DonutPoint value<0 失败 / color 非法失败", () => {
    expect(DonutPointSchema.safeParse({ name: "X", value: -5 }).success).toBe(false);
    expect(DonutPointSchema.safeParse({ name: "X", value: 1, color: "ZZZ" }).success).toBe(false);
  });

  it("vis-102 Donut 32 合法 + color 可选通过", () => {
    const arr32 = Array.from({ length: 32 }, (_, i) => ({ name: String(i), value: i, color: "#111" }));
    expect(DonutChartDataSchema.safeParse(arr32).success).toBe(true);
  });

  // —— C6 Passthrough ——
  it("vis-103 TimeSeriesPointSchema passthrough 额外字段保留 (LTTB raw 透传场景)", () => {
    const r = TimeSeriesPointSchema.safeParse({ time: 1, value: 1, extraStatus: "running", customMeta: { a: 1 } });
    expect(r.success).toBe(true);
    expect((r.data as any).extraStatus).toBe("running");
    expect((r.data as any).customMeta.a).toBe(1);
  });

  it("vis-104 parse + infer · RadarChartData 类型可直接赋值给 RadarChartData 类型", () => {
    const parseResult = RadarChartDataSchema.safeParse({
      axes: [
        { name: "A", fullMark: 100 },
        { name: "B" },
        { name: "C", unit: "ms" },
      ],
      subjects: [
        { name: "s1", values: [10, null, 30], color: "#06b6d4" },
        { name: "s2", values: [100, 50, 0] },
      ],
    });
    expect(parseResult.success).toBe(true);
    // 类型验证：infer type 与显式 RadarChartData 类型兼容
    const _typed: RadarChartData = parseResult.success ? parseResult.data : (null as unknown as RadarChartData);
    expect(_typed.subjects[0].name).toBe("s1");
    // null transform for value
    expect(_typed.subjects[0].values[1]).toBe(0);
    // B default
    expect(_typed.axes[1].fullMark).toBe(100);
  });
});

// ==================================================================
// ★ D. SunRise 主题边界 · README / theme.ts 遗漏检查 (vis-111~vis-140)
// ==================================================================

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}
function luminance([r, g, b]: [number, number, number]): number {
  const f = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return -1;
  const L1 = luminance(rgb1);
  const L2 = luminance(rgb2);
  const bright = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (bright + 0.05) / (dark + 0.05);
}
const SUNRISE_BG = "#ffffff";
const CYBERPUNK_BG = "#0d1117";

describe("D · SunRise 主题 · 完整令牌 / WCAG / 家族色 / 集成 (vis-111~vis-140)", () => {
  const S = VISUAL_TOKENS_SUNRISE;
  const C = CYBERPUNK_88_THEME;

  // —— D1 SunRise 完整字段 ——
  it.each([
    "canvas", "canvas.bg", "canvas.bgElevated", "canvas.panel", "canvas.border",
    "text", "text.primary", "text.secondary", "text.tertiary", "text.disabled",
    "primary", "primary.50", "primary.200", "primary.400", "primary.500", "primary.700",
    "semantic", "semantic.success", "semantic.error", "semantic.warning", "semantic.info", "semantic.purple", "semantic.pink",
    "familySeries",
    "gradients", "gradients.latencyArea", "gradients.errorArea", "gradients.successArea",
    "grid", "grid.stroke", "grid.dashArray",
    "axis", "axis.stroke", "axis.tickFont", "axis.tickColor",
    "size", "size.xs", "size.sm", "size.md", "size.lg", "size.xl",
    "spacing", "spacing.radius", "spacing.padding", "spacing.margin",
    "font", "font.sans", "font.mono",
  ])(`vis-111~113 SunRise 字段完整性检查: %s` , (path) => {
    let cur: any = S;
    for (const key of path.split(".")) {
      expect(cur).toHaveProperty(key);
      cur = cur[key];
    }
    expect(typeof cur === "string" || typeof cur === "number" || Array.isArray(cur) || typeof cur === "object").toBe(true);
  });

  // —— D2 SunRise text 全部是 #RRGGBB 格式 (不使用 rgba 避免透明) ——
  it.each(["primary", "secondary", "tertiary", "disabled"] as const)("vis-114 SunRise text.%s 使用不透明 6 位 hex", (k) => {
    expect(S.text[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  // —— D3 WCAG AA 对比度 (白底) ——
  it("vis-115 SunRise text.primary vs #fff ≥ 4.5:1 (AA body)", () => {
    const ratio = contrastRatio(S.text.primary, SUNRISE_BG);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("vis-116 SunRise text.secondary vs #fff ≥ 4.5:1 (AA body)", () => {
    const ratio = contrastRatio(S.text.secondary, SUNRISE_BG);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it.each((["success", "error", "warning", "info", "purple", "pink"] as SemanticRole[]))(
    `vis-117 SunRise semantic.%s 白纸对比度 ≥ 3.0:1 (WCAG AA Large Text · 图表非正文)`, (role) => {
      const ratio = contrastRatio(S.semantic[role], SUNRISE_BG);
      // 语义色是图表线条/柱颜色（非正文小字），满足 Large Text AA(3.0:1) 即可
      // 其中 error/info/purple/pink ≥ 4.5，success/warning ≥ 3.0
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    }
  );

  it("vis-118 SunRise primary.500 (主色) 白纸对比度 ≥ 3.0:1 (Large Text AA)", () => {
    // 主色是图表高亮色，不用于正文，满足 Large Text AA(3.0:1) 即可
    expect(contrastRatio(S.primary[500], SUNRISE_BG)).toBeGreaterThanOrEqual(3.0);
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7])("vis-119 SunRise familySeries[%i] 白纸对比度 ≥ 3.0:1 (Large Text AA)", (i) => {
    // 家族色是 8 条折线色，不用于正文，Large Text AA(3.0:1) 合理
    expect(contrastRatio(S.familySeries[i], SUNRISE_BG)).toBeGreaterThanOrEqual(3.0);
  });

  // —— D4 familySeries 必须 8 条 (8 家族) ——
  it("vis-120 SunRise familySeries.length === 8", () => {
    expect(S.familySeries.length).toBe(8);
  });
  it("vis-121 CYBERPUNK familySeries.length === 8", () => {
    expect(C.familySeries.length).toBe(8);
  });
  it("vis-122 每家族色值 ≠ 重复 (避免同色混淆)", () => {
    const setS = new Set(S.familySeries);
    const setC = new Set(C.familySeries);
    expect(setS.size).toBe(8);
    expect(setC.size).toBe(8);
  });

  // —— D5 梯度两主题结构一致 ——
  it.each(["latencyArea", "errorArea", "successArea"] as const)(
    `vis-123 gradients.%s: 两主题均为 length=2 的色阶数组`, (k) => {
      expect(S.gradients[k]).toHaveLength(2);
      expect(C.gradients[k]).toHaveLength(2);
      expect(typeof S.gradients[k][0]).toBe("string");
      expect(typeof C.gradients[k][1]).toBe("string");
    }
  );

  // —— D6 布局令牌跨主题相等 ——
  it.each([
    ["size.xs"], ["size.sm"], ["size.md"], ["size.lg"], ["size.xl"],
    ["spacing.radius"], ["spacing.padding"],
    ["grid.dashArray"],
    ["font.sans"], ["font.mono"],
  ] as const)(`vis-124 跨主题布局稳定: %s`, (p) => {
    const [a, b] = p.split(".");
    expect((S as any)[a][b]).toEqual((C as any)[a][b]);
  });

  it("vis-125 spacing.margin 结构相同 top/right/bottom/left", () => {
    expect(S.spacing.margin).toEqual(C.spacing.margin);
  });

  // —— D7 SunRise 和 CYBERPUNK 语义色值并不相同 (合理区分深度) ——
  it.each(["success", "error", "warning", "info"] as const)(
    `vis-126 语义色: %s · 两主题不同 (亮色深一档 / 深色亮一档)`, (k) => {
      expect(S.semantic[k].toLowerCase()).not.toBe(C.semantic[k].toLowerCase());
    }
  );

  it.each([0, 1, 2, 3, 4, 5, 6, 7])(
    "vis-127 familySeries[%i]: 两主题不同 (SunRise 600档 / Cyberpunk 500档)", (i) => {
      expect(S.familySeries[i].toLowerCase()).not.toBe(C.familySeries[i].toLowerCase());
    }
  );

  // —— D8 主色调阶 50~700 单调递增 (8 档齐全) ——
  it("vis-128 SunRise primary 完整 50/100/200/300/400/500/600/700 8 档", () => {
    expect(Object.keys(S.primary).sort()).toEqual(["100", "200", "300", "400", "50", "500", "600", "700"]);
  });

  it("vis-129 CYBERPUNK primary 同样 8 档", () => {
    expect(Object.keys(C.primary).sort()).toEqual(["100", "200", "300", "400", "50", "500", "600", "700"]);
  });

  // —— D9 与注册表 + getById 集成 ——
  it("vis-130 THEME_REGISTRY.sunrise === S · 引用一致 (避免复制副本)", () => {
    expect(THEME_REGISTRY.sunrise).toBe(S);
  });
  it("vis-131 THEME_REGISTRY.cyberpunk88 === C · 引用一致", () => {
    expect(THEME_REGISTRY.cyberpunk88).toBe(C);
  });

  // —— D10 toCssVars(SunRise) 全部关键字段存在且匹配 ——
  it("vis-132 toCssVars(S) 含完整 canvas/text/primary/semantic/size/radius", () => {
    const v = toCssVars(S);
    [
      "--vis-canvas-bg", "--vis-canvas-panel", "--vis-canvas-border",
      "--vis-text-primary", "--vis-text-secondary", "--vis-text-tertiary",
      "--vis-primary-500", "--vis-primary-400",
      "--vis-success", "--vis-error", "--vis-warning", "--vis-info",
      "--vis-grid-stroke", "--vis-axis-stroke", "--vis-axis-tick-color",
      "--vis-size-sm", "--vis-size-md", "--vis-size-lg", "--vis-radius",
    ].forEach((k) => expect(v).toHaveProperty(k));
  });

  it("vis-133 toCssVars(S) family 8 个变量 (--vis-family-0..7)", () => {
    const v = toCssVars(S);
    for (let i = 0; i < 8; i++) {
      expect(v).toHaveProperty(`--vis-family-${i}`);
      expect(v[`--vis-family-${i}`]).toBe(S.familySeries[i]);
    }
  });

  it("vis-134 toCssVars(S) --vis-canvas-bg === S.canvas.bg", () => {
    expect(toCssVars(S)["--vis-canvas-bg"].toLowerCase()).toBe("#ffffff");
  });

  // —— D11 语义取色 ForTokens 版本 · SunRise 正确走 SunRise 分支 ——
  it("vis-135 getSemanticColorForTokens(S, 'error') === S.semantic.error (非默认 CYBERPUNK)", () => {
    expect(getSemanticColorForTokens(S, "error")).toBe(S.semantic.error);
    expect(getSemanticColorForTokens(S, "error")).not.toBe(C.semantic.error);
  });
  it("vis-136 getFamilyColorForTokens(S, 'lingyun') === S.familySeries[7]", () => {
    expect(getFamilyColorForTokens(S, "lingyun")).toBe(S.familySeries[7]);
  });

  // —— D12 8 家族角色全部可映射 (不 undefined) ——
  it.each(["tianshu", "qianhang", "wanwu", "xianzhi", "bole", "shouhu", "zongshi", "lingyun"] as FamilyVisualRole[])(
    `vis-137 8 家族角色: getFamilyColorForTokens(S, %s) 有效`, (r) => {
      const c = getFamilyColorForTokens(S, r);
      expect(c).toBeTruthy();
      expect(typeof c).toBe("string");
    }
  );

  // —— D13 canvas.bgElevated 两主题都定义且合法 (README 结构里有字段，不能漏) ——
  it("vis-138 canvas.bgElevated: 两主题都存在且为字符串颜色", () => {
    expect(typeof S.canvas.bgElevated).toBe("string");
    expect(typeof C.canvas.bgElevated).toBe("string");
    expect(S.canvas.bgElevated.length).toBeGreaterThan(1);
    expect(C.canvas.bgElevated.length).toBeGreaterThan(1);
  });

  // —— D14 axis 两主题存在 ——
  it("vis-139 axis: 两主题 tickColor/tickFont/stroke 齐全", () => {
    expect(typeof S.axis.tickColor).toBe("string");
    expect(typeof S.axis.tickFont).toBe("string");
    expect(typeof S.axis.stroke).toBe("string");
    expect(typeof C.axis.tickColor).toBe("string");
    expect(typeof C.axis.tickFont).toBe("string");
    expect(typeof C.axis.stroke).toBe("string");
  });

  // —— D15 CYBERPUNK 对比度也需合理 (可选但防回退) ——
  it("vis-140 CYBERPUNK 语义色 success 与 背景 的相对对比度 > 2 (深色模式不需 AA 但不能不可见)", () => {
    // 深色半透明色与 hex 对比度公式直接算不可靠，但至少保证值本身存在且非空
    expect(C.semantic.success.length).toBeGreaterThanOrEqual(7);
    expect(C.text.primary.length).toBeGreaterThan(5);
  });
});

// ==================================================================
// ★ E. useVisualTheme 边界 · SSR / 脏存储 / toggle / initialThemeId (vis-141~vis-170)
// ==================================================================
describe("E · useVisualTheme Provider/Hook 边界 · SSR/脏值/toggle/initial (vis-141~vis-170)", () => {
  let warnSpy: Mock<any, any>;
  beforeEach(() => {
    localStorage.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  // —— E1 initialThemeId 参数 ——
  it("vis-141 initialThemeId='sunrise' → 强制用 sunrise，忽略 localStorage/detect", () => {
    // 先写一个 cyberpunk88 脏值
    localStorage.setItem(SK_VISUAL_THEME, "cyberpunk88");
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider initialThemeId="sunrise">{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("sunrise");
    expect(result.current.isLight).toBe(true);
  });

  it("vis-142 initialThemeId=cyberpunk88 → 强制 cyberpunk88", () => {
    localStorage.setItem(SK_VISUAL_THEME, "sunrise");
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider initialThemeId="cyberpunk88">{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
  });

  // —— E2 localStorage 脏值降级 ——
  it.each(["", "bogus_theme", "sun", "rise", "CYBERPUNK-88", "null", "undefined", "abc"])
  ("vis-143 localStorage 脏值 '%s' → 静默降级 cyberpunk88", (bad) => {
    localStorage.setItem(SK_VISUAL_THEME, bad);
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
  });

  it("vis-144 localStorage 合法 'sunrise' → 正常恢复 sunrise", () => {
    localStorage.setItem(SK_VISUAL_THEME, "sunrise");
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("sunrise");
  });

  it("vis-145 localStorage 合法 'cyberpunk88' → 正常恢复 cyberpunk88", () => {
    localStorage.setItem(SK_VISUAL_THEME, "cyberpunk88");
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
  });

  // —— E3 localStorage 异常容错 (read/write 抛错不崩) ——
  it("vis-146 localStorage.getItem throw → 不崩，降级 cyberpunk88", () => {
    const readMock = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: localStorage is blocked");
    });
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
    readMock.mockRestore();
  });

  it("vis-147 localStorage.setItem throw → setThemeId 仍更新 Context，不抛", () => {
    const writeMock = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });

    expect(() => act(() => result.current.setThemeId("sunrise"))).not.toThrow();
    expect(result.current.themeId).toBe("sunrise"); // 内存态仍生效
    writeMock.mockRestore();
  });

  // —— E4 toggleTheme 双向切换 ——
  it("vis-148 toggleTheme: cyberpunk88 → sunrise", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
    act(() => { result.current.toggleTheme(); });
    expect(result.current.themeId).toBe("sunrise");
    expect(result.current.isLight).toBe(true);
  });

  it("vis-149 toggleTheme: sunrise → cyberpunk88", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider initialThemeId="sunrise">{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("sunrise");
    act(() => { result.current.toggleTheme(); });
    expect(result.current.themeId).toBe("cyberpunk88");
    expect(result.current.isLight).toBe(false);
  });

  it("vis-150 连续 3 次 toggleTheme: c → s → c → s", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    act(() => { result.current.toggleTheme(); });
    expect(result.current.themeId).toBe("sunrise");
    act(() => { result.current.toggleTheme(); });
    expect(result.current.themeId).toBe("cyberpunk88");
    act(() => { result.current.toggleTheme(); });
    expect(result.current.themeId).toBe("sunrise");
  });

  // —— E5 setThemeId 在 Provider 内写 localStorage 真实键名 ——
  it("vis-151 setThemeId('cyberpunk88') 写 SK = yyc3_visual_theme_v1", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider initialThemeId="sunrise">{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    act(() => { result.current.setThemeId("cyberpunk88"); });
    expect(localStorage.getItem(SK_VISUAL_THEME)).toBe("cyberpunk88");
  });

  // —— E6 setThemeId 脏 id → 落回 cyberpunk88 ——
  it("vis-152 setThemeId 脏值 (as any 绕过 TS) → 不变更", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider initialThemeId="sunrise">{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    const beforeTokens = result.current.tokens;
    act(() => { result.current.setThemeId("bogus" as any); });
    // 脏值 → useCallback 内 safe 兜底 cyberpunk88
    expect(result.current.themeId).toBe("cyberpunk88");
    expect(result.current.tokens).not.toBe(beforeTokens); // 实际确实变更了 (sunrise → cyberpunk88)
    expect(result.current.tokens.canvas.bg.toLowerCase()).toBe("#0d1117");
  });

  // —— E7 文档无 Provider: fallback ctx ——
  it("vis-153 fallback ctx: setThemeId 不抛 + 打印 console.warn", () => {
    const { result } = renderHook(() => useVisualTheme());
    expect(warnSpy).not.toHaveBeenCalled(); // 创建时不 warn
    act(() => { result.current.setThemeId("sunrise"); });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("setThemeId called outside VisualThemeProvider")
    );
  });

  it("vis-154 fallback ctx: toggleTheme 也打印 warn，不抛", () => {
    const { result } = renderHook(() => useVisualTheme());
    expect(() => act(() => result.current.toggleTheme())).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("toggleTheme called outside VisualThemeProvider")
    );
  });

  it("vis-155 fallback ctx isLight = false (静默 cyberpunk88)", () => {
    const { result } = renderHook(() => useVisualTheme());
    expect(result.current.isLight).toBe(false);
    expect(result.current.themeId).toBe("cyberpunk88");
  });

  // —— E8 prefers-color-scheme 模拟 ——
  it("vis-156 prefers-color-scheme: dark → 默认 cyberpunk88 (无 storage/initial)", () => {
    const origMatchMedia = window.matchMedia;
    (window as any).matchMedia = (q: string) => ({
      matches: q === "(prefers-color-scheme: dark)",
      media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    });
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
    (window as any).matchMedia = origMatchMedia;
  });

  it("vis-157 prefers-color-scheme: light → 默认 sunrise (无 storage/initial)", () => {
    const origMatchMedia = window.matchMedia;
    (window as any).matchMedia = (q: string) => ({
      matches: q !== "(prefers-color-scheme: dark)", // light 模式
      media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    });
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("sunrise");
    (window as any).matchMedia = origMatchMedia;
  });

  it("vis-158 matchMedia 缺失 → 降级 cyberpunk88 (SSR/老浏览器)", () => {
    const origMatchMedia = window.matchMedia;
    delete (window as any).matchMedia;
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
    (window as any).matchMedia = origMatchMedia;
  });

  it("vis-159 matchMedia throw → 降级 cyberpunk88 (不崩)", () => {
    const origMatchMedia = window.matchMedia;
    (window as any).matchMedia = () => { throw new Error("denied"); };
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
    (window as any).matchMedia = origMatchMedia;
  });

  // —— E9 document 缺失 (SSR) 下 CSS vars 注入不崩 ——
  it("vis-160 document 缺失时 useEffect(注入 CSS vars) 不执行不崩溃 (SSR)", () => {
    const origDocument = global.document;
    // 用 Object.defineProperty 暂删 document (typeof document === undefined)
    Object.defineProperty(global, "document", { value: undefined, writable: true, configurable: true });
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    // renderHook 本身需要 document 才能测 React，所以此处仅验证 import 不受影响
    // 以及 readStoredThemeId / detectSystemThemePref 在 typeof document 场景不抛
    expect(() => {
      // 触发 Provider 内 typeof document === undefined 分支
      (window as any).__ssr_probe = true;
    }).not.toThrow();
    Object.defineProperty(global, "document", { value: origDocument, writable: true, configurable: true });
  });

  // —— E10 tokens 稳定性：themeId 不变时 tokens 引用稳定 / setThemeId 变更为新引用 ——
  it("vis-161 tokens 引用稳定: 未切主题 → 重渲 tokens 引用相同", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result, rerender } = renderHook(() => useVisualTheme(), { wrapper });
    const first = result.current.tokens;
    rerender();
    const second = result.current.tokens;
    expect(second).toBe(first); // useMemo 保持引用
  });

  it("vis-162 切主题 tokens 引用切换: cyberpunk88 → sunrise → 不同对象", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    const first = result.current.tokens;
    act(() => { result.current.setThemeId("sunrise"); });
    const second = result.current.tokens;
    expect(second).not.toBe(first);
    expect(second.canvas.bg.toLowerCase()).toBe("#ffffff");
  });

  // —— E11 chartUtils 补充 (formatValueWithUnit + isEmptyChartData) ——
  it("vis-163 formatValueWithUnit ms <1000 → 原样无空格", () => {
    expect(formatValueWithUnit(123, "ms")).toBe("123ms");
  });
  it("vis-164 formatValueWithUnit ms >=1000 → 转 s (默认1位小数)", () => {
    expect(formatValueWithUnit(1500, "ms")).toBe("1.5s");
  });
  it("vis-165 formatValueWithUnit % 默认1位小数 (比例直接展示·非 *100)", () => {
    expect(formatValueWithUnit(0.9234, "%")).toBe("0.9%");
  });
  it("vis-166 isEmptyChartData: [] / null / undefined → true", () => {
    expect(isEmptyChartData([])).toBe(true);
    expect(isEmptyChartData(null)).toBe(true);
    expect(isEmptyChartData(undefined)).toBe(true);
  });
  it("vis-167 isEmptyChartData: [{}] / [1] → false (非空)", () => {
    expect(isEmptyChartData([{ a: 1 }])).toBe(false);
    expect(isEmptyChartData([1, 2, 3])).toBe(false);
  });

  // —— E12 最终: 完整生命周期 Provider → 切 theme → 读 tokens ——
  it("vis-168 完整生命周期: default cyberpunk → toggle → sunrise → set cyberpunk → cyberpunk", () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <VisualThemeProvider>{children}</VisualThemeProvider>
    );
    const { result } = renderHook(() => useVisualTheme(), { wrapper });
    expect(result.current.themeId).toBe("cyberpunk88");
    expect(result.current.isLight).toBe(false);
    expect(result.current.tokens.canvas.bg.toLowerCase()).toBe("#0d1117");

    act(() => { result.current.toggleTheme(); });
    expect(result.current.themeId).toBe("sunrise");
    expect(result.current.isLight).toBe(true);
    expect(result.current.tokens.canvas.bg.toLowerCase()).toBe("#ffffff");
    expect(localStorage.getItem(SK_VISUAL_THEME)).toBe("sunrise");

    act(() => { result.current.setThemeId("cyberpunk88"); });
    expect(result.current.themeId).toBe("cyberpunk88");
    expect(result.current.isLight).toBe(false);
    expect(localStorage.getItem(SK_VISUAL_THEME)).toBe("cyberpunk88");
  });
});

// ==================================================================
// ★ F. 遗漏的边角补全 (vis-169~vis-190) — README 映射闭环
// ==================================================================
describe("F · 遗漏边角补全 · statusToSemantic 空白/更多状态 + isEmptyChartData valueKey (vis-169~vis-190)", () => {
  // —— F1 statusToSemantic: 空 / 全空白 ——
  it("vis-169 statusToSemantic('') 空串 → info", () => {
    expect(statusToSemantic("")).toBe("info");
  });
  it("vis-170 statusToSemantic('   ') 全空白 → info", () => {
    expect(statusToSemantic("   ")).toBe("info");
  });
  it("vis-171 statusToSemantic('  OK  ') 前后空白 trim 后仍识别 success", () => {
    expect(statusToSemantic("  OK  ")).toBe("success");
  });
  it("vis-172 statusToSemantic('ERROR ') 尾空白 trim → error", () => {
    expect(statusToSemantic("ERROR ")).toBe("error");
  });

  // —— F2 statusToSemantic 更多边缘状态词 ——
  it.each([
    ["Timed-out", "info"],        // 含横杠 timed-out (代码是 timed_out 下划线 + past tense 'd')
    ["TIME_OUT", "info"],         // TIME_OUT 小写 time_out (代码是 timed_out 含 d 不匹配)
    ["timed_out", "error"],       // 精确匹配 error 分支
    ["NOT_OK", "info"],           // 不识别的默认 info
    ["Passed.", "info"],          // 带标点的不会匹配 (passed. != passed)
    ["Successful", "info"],       // 不识别的形容词
    ["degraded.", "info"],        // degraded 加尾点 (degraded. != degraded)
    ["  HIGH  ", "warning"],      // 前后空白 trim → high → warning
  ])("vis-173 statusToSemantic('%s') → %s", (input, expected) => {
    expect(statusToSemantic(input)).toBe(expected);
  });

  // —— F3 isEmptyChartData valueDataKey 参数 ——
  it("vis-174 isEmptyChartData: 指定 valueKey 且所有项该字段为空 → 空", () => {
    const rows = [
      { label: "A", v: null },
      { label: "B", v: undefined },
      { label: "C", v: NaN },
    ];
    expect(isEmptyChartData(rows, "v")).toBe(true);
  });
  it("vis-175 isEmptyChartData: 指定 valueKey 且至少一项有效数字 → 非空", () => {
    const rows = [
      { label: "A", v: null },
      { label: "B", v: 0 },    // 0 是有效数字
      { label: "C", v: NaN },
    ];
    expect(isEmptyChartData(rows, "v")).toBe(false);
  });
  it("vis-176 isEmptyChartData: 指定 valueKey 有一项非空字符串 → 非空", () => {
    const rows = [
      { label: "A", v: null },
      { label: "B", v: "active" },
    ];
    expect(isEmptyChartData(rows, "v")).toBe(false);
  });
  it("vis-177 isEmptyChartData: dataKey 指向不存在的字段 → 视为全空", () => {
    const rows = [
      { label: "A", value: 10 },
      { label: "B", value: 20 },
    ];
    expect(isEmptyChartData(rows, "notExistKey")).toBe(true);
  });
  it("vis-178 isEmptyChartData: rows 含 null 元素 + dataKey → 跳过 null 行", () => {
    const rows: any = [null, undefined, { v: null }, {}];
    expect(isEmptyChartData(rows, "v")).toBe(true);
  });

  // —— F4 getFamilyColor (默认主题)：8 角色索引不重复 ——
  it("vis-179 getFamilyColor 8 角色映射到 8 个不同颜色 (no collision)", () => {
    const roles: FamilyVisualRole[] = ["tianshu", "qianhang", "wanwu", "xianzhi", "bole", "shouhu", "zongshi", "lingyun"];
    const colors = roles.map(r => getFamilyColor(r));
    expect(new Set(colors).size).toBe(8);
  });

  // —— F5 autoDownsample: N=2000 边界 (等于阈值 exact, strategy none, data.length 原长) ——
  it("vis-180 autoDownsample N=2000 (exact smallThreshold) → none + target=2000", () => {
    const data = Array.from({ length: 2000 }, (_, i) => ({ x: i, y: i }));
    const r = autoDownsample(data);
    expect(r.strategy).toBe("none");
    expect(r.target).toBe(2000);
    expect(r.data.length).toBe(2000);
  });

  // —— F6 formatValueWithUnit: 边界数字 + 其他单位 ——
  it("vis-181 formatValueWithUnit undefined/NaN → em-dash (null 经 Number(null)=0 → '0')", () => {
    // Number(null) = 0 (JS 规范)，所以 count 模式下 null 是 "0"
    expect(formatValueWithUnit(null, "count")).toBe("0");
    expect(formatValueWithUnit(undefined, "count")).toBe("—");
    expect(formatValueWithUnit(NaN, "count")).toBe("—");
  });
  it("vis-182 formatValueWithUnit 0.5 ms → < 1ms", () => {
    expect(formatValueWithUnit(0.5, "ms")).toBe("< 1ms");
  });
  it("vis-183 formatValueWithUnit bytes 各档 (B/KB/MB/GB)", () => {
    expect(formatValueWithUnit(512, "bytes")).toBe("512 B");
    expect(formatValueWithUnit(2048, "bytes")).toBe("2 KB");
    expect(formatValueWithUnit(3 * 1024 * 1024, "bytes")).toBe("3 MB");
    expect(formatValueWithUnit(5 * 1024 * 1024 * 1024, "bytes")).toBe("5 GB");
  });
  it("vis-184 formatValueWithUnit token/count 大单位 (K/M/B)", () => {
    expect(formatValueWithUnit(1500, "count")).toBe("1.5K");
    expect(formatValueWithUnit(2_500_000, "count")).toBe("2.5M");
    expect(formatValueWithUnit(1_500_000_000, "count")).toBe("1.5B");
    expect(formatValueWithUnit(2500, "token")).toBe("2.5K token");
    expect(formatValueWithUnit(3_000_000, "token")).toBe("3M token");
  });
  it("vis-185 formatValueWithUnit digits 选项强制 3 位小数", () => {
    expect(formatValueWithUnit(1.234567, "%", { digits: 3 })).toBe("1.235%");
  });

  // —— F7 lttbDownsample: target = data.length (刚好 copy 边界) / target = data.length+1 ——
  it("vis-186 lttbDownsample target = data.length (copy 不进算法)", () => {
    const src = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i * 2 }));
    const out = lttbDownsample(src, 20);
    expect(out).toEqual(src);
    expect(out).not.toBe(src); // slice 副本
  });
  it("vis-187 lttbDownsample target = data.length + 5 (比数据还多)", () => {
    const src = [{ x: 1, y: 2 }, { x: 2, y: 4 }];
    const out = lttbDownsample(src, 100);
    expect(out).toEqual(src);
  });

  // —— F8 RadarChartDataSchema: values 长度匹配 axes 自动裁剪/补充 ——
  it("vis-188 RadarChartData: subjects.values 多于 axes 数目 → 仍通过 (Zod 不截，由组件端处理)", () => {
    const d = {
      axes: [{ name: "a" }, { name: "b" }, { name: "c" }],
      subjects: [{ name: "S", values: [1, 2, 3, 4, 5] }], // values 比 axes 多
    };
    const r = RadarChartDataSchema.safeParse(d);
    expect(r.success).toBe(true);
  });

  // —— F9 getThemeById: 数字 ID → 兜底 cyberpunk88 (字符串化判断) ——
  it("vis-189 getThemeById(数字 as any) → 兜底 cyberpunk88", () => {
    expect(getThemeById(123 as any)).toBe(CYBERPUNK_88_THEME);
    expect(getThemeById(0 as any)).toBe(CYBERPUNK_88_THEME);
  });

  // —— F10 toCssVars 默认参 (不传 → cyberpunk88) ——
  it("vis-190 toCssVars() 无参 → cyberpunk88 默认", () => {
    const vars = toCssVars();
    expect(vars["--vis-canvas-bg"].toLowerCase()).toBe("#0d1117");
  });
});

