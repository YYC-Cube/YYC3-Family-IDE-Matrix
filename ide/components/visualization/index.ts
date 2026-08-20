/**
 * file: index.ts
 * description: 可视化工具库统一出口 · 双主题 + Zod 校验 + LTTB 降采样 + 图表工具
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v2.0.0
 * created: 2026-08-19
 * updated: 2026-08-19
 * status: active
 * tags: [library],[visualization],[index],[barrel],[re-export]
 *
 * brief: 可视化模块的「单一入口」— 其他模块从这里按需 import，无需关心子目录结构
 *
 * details:
 *   其他模块 (model-settings / agent / snapshot) 直接使用：
 *     import {
 *       // 1. 主题令牌 + Context
 *       CYBERPUNK_88_THEME, VISUAL_TOKENS_SUNRISE, THEME_REGISTRY,
 *       getThemeById, VisualThemeProvider, useVisualTheme,
 *       // 2. 语义/家族取色 (主题默认版 + ForTokens 版)
 *       getSemanticColor, getFamilyColor, statusToSemantic, statusColor,
 *       getSemanticColorForTokens, getFamilyColorForTokens, statusColorForTokens,
 *       toCssVars,
 *       // 3. Zod 校验 Schema (数据契约)
 *       TimeSeriesPointSchema, LineChartDataSchema,
 *       BarPointSchema, BarChartDataSchema,
 *       RadarAxisSchema, RadarSubjectSchema, RadarChartDataSchema,
 *       DonutPointSchema, DonutChartDataSchema,
 *       type TimeSeriesPoint, type LineChartData,
 *       type BarPoint, type BarChartData,
 *       type RadarAxis, type RadarSubject, type RadarChartData,
 *       type DonutPoint, type DonutChartData,
 *       // 4. LTTB 降采样算法
 *       lttbDownsample, autoDownsample,
 *       type LTTBPoint, type AutoDownsampleOptions,
 *       // 5. 图表通用工具
 *       makeChartGradId, formatValueWithUnit, isEmptyChartData,
 *       type FormatValueOptions,
 *       // 6. 类型
 *       type VisualTokensType, type ThemeId,
 *       type SemanticRole, type FamilyVisualRole,
 *       type VisualThemeContextValue, type VisualThemeProviderProps,
 *     } from "@/components/visualization";
 *
 *   五高架构：
 *   - 高扩展：新增组件/Schema/工具只需在此文件追加 export，消费方路径不变
 *   - 高可用：所有消费方不依赖子目录，重构子目录结构不破坏消费
 *   - 高性能：tree-shaking 友好 (named export + type export 分离)
 *   - 高安全：类型通过 TS exact export 暴露，无 any 泄漏
 *   - 高智能：README 契约 → 实际实现 → 测试 → 消费 4 层闭环
 *
 * dependencies: ./theme, ./useVisualTheme,
 *               ./validators/chart.schemas,
 *               ./utils/lttb, ./utils/chartUtils
 * exports: 命名导出 (不建议使用 import * as vis，会阻止 tree-shaking)
 * notes: 本文件是唯一公开 API，其他文件属于「内部实现」，消费方不得直接 import 子目录
 */

// ==================================================================
// 1. 主题令牌 + 类型 (theme.ts)
// ==================================================================
export {
  /** 深色赛博朋克主题 (v1.0 默认) */
  CYBERPUNK_88_THEME,
  /** 亮色日出主题 (v2.0 新增 · WCAG AA) */
  VISUAL_TOKENS_SUNRISE,
  /** 向后兼容：便捷别名 t */
  t,
  /** 向后兼容：老 tokens.ts 名称 */
  VISUAL_TOKENS_CYBERPUNK_88,
  /** 向后兼容：老 tokens.ts 名称 */
  VISUAL_TOKENS,
  /** 主题注册表 (唯一数据源) */
  THEME_REGISTRY,
  /** 按 ID 取主题，脏值兜底 cyberpunk88 */
  getThemeById,
  // —— 语义/家族取色 · 主题默认版 (向后兼容) ——
  getSemanticColor,
  getFamilyColor,
  statusToSemantic,
  statusColor,
  // —— 语义/家族取色 · 指定 tokens 版 (动态切换) ——
  getSemanticColorForTokens,
  getFamilyColorForTokens,
  statusColorForTokens,
  /** 转换为 CSS var Record，注入 :root */
  toCssVars,
} from "./theme";

export type {
  /** 完整主题令牌类型 (合同定义) */
  VisualTokensType,
  /** 主题 ID 联合：cyberpunk88 | sunrise */
  ThemeId,
  /** 语义色 6 角色：success/error/warning/info/purple/pink */
  SemanticRole,
  /** 8 家族视觉角色：tianshu/qianhang/wanwu/xianzhi/bole/shouhu/zongshi/lingyun */
  FamilyVisualRole,
} from "./theme";

// ==================================================================
// 2. Context Provider + Hook (useVisualTheme)
// ==================================================================
export {
  /** 应用根节点必须包裹的 Provider (单一数据源原则) */
  VisualThemeProvider,
  /** 图表组件读取主题的唯一 Hook 入口 */
  useVisualTheme,
  /** Context 实例 (高级用法：多 Provider 嵌套时手动消费) */
  VisualThemeContext,
  /** I-修复·SSR 工具：ThemeSwitcher 等受控组件防水合闪烁门闩 (mounted=false 时先不渲染 Switch) */
  useIsVisualThemeMounted,
  /** I-修复·SSR 工具：从任意 Cookie string 安全解析 ThemeId (Next.js Server Component 可用) */
  readThemeFromCookieString,
  /** I-修复·SSR 工具：readThemeFromCookieString 的更口语化别名 */
  readThemeFromCookie,
  /** I-修复·常量：localStorage & Cookie 共用的主题存储 key (与 SSR 层约定) */
  COOKIE_VISUAL_THEME,
} from "./useVisualTheme";

export type {
  /** useVisualTheme() 返回值类型 (v2.0 新增 isMounted 门闩字段) */
  VisualThemeContextValue,
  /** VisualThemeProvider props 类型 (v2.0 新增 initialThemeId + disableMountedGate 可选) */
  VisualThemeProviderProps,
} from "./useVisualTheme";

// ==================================================================
// 3. Zod 数据契约 Schemas (validators/chart.schemas)
// ==================================================================
export {
  // 时序折线图
  TimeSeriesPointSchema,
  LineChartDataSchema,
  // 柱状图
  BarPointSchema,
  BarChartDataSchema,
  // 雷达图 (Agent 画像核心)
  RadarAxisSchema,
  RadarSubjectSchema,
  RadarChartDataSchema,
  // 环形图
  DonutPointSchema,
  DonutChartDataSchema,
} from "./validators/chart.schemas";

export type {
  // 时序折线图
  TimeSeriesPoint,
  LineChartData,
  // 柱状图
  BarPoint,
  BarChartData,
  // 雷达图
  RadarAxis,
  RadarSubject,
  RadarChartData,
  // 环形图
  DonutPoint,
  DonutChartData,
} from "./validators/chart.schemas";

// ==================================================================
// 4. LTTB 时序降采样算法 (utils/lttb)
// ==================================================================
export {
  /** 核心 LTTB 算法：手动指定目标点数 */
  lttbDownsample,
  /** 4 档自动分档：≤2k/none · <10k/md→400 · <50k/lg→500 · ≥50k/xl→600 */
  autoDownsample,
} from "./utils/lttb";

export type {
  /** LTTB 要求的点结构：必须有 x,y，可选 raw 透传元数据 */
  LTTBPoint,
  /** autoDownsample 自定义阈值/目标点数 */
  AutoDownsampleOptions,
} from "./utils/lttb";

// ==================================================================
// 5. 图表通用工具 (utils/chartUtils)
// ==================================================================
export {
  /** SVG 渐变唯一 ID 生成器：解决多图表 ID 冲突串色 */
  makeChartGradId,
  /** 数值+单位智能格式化：ms/s、B/KB/MB/GB、K/M/B 大数字 */
  formatValueWithUnit,
  /** 图表空数据判断：支持 null/undefined/[]/非数组/指定 dataKey 全空 */
  isEmptyChartData,
} from "./utils/chartUtils";

export type {
  /** formatValueWithUnit options：小数位、千分位 */
  FormatValueOptions,
} from "./utils/chartUtils";

// ==================================================================
// 6. 图表组件 (charts/) — 可选导出，方便全局注册
// ==================================================================
export { RadarChart } from "./charts/RadarChart";
export type { RadarChartProps } from "./charts/RadarChart";

/**
 * 库版本号 (建议消费方在开发工具中打印，用于 Bug 报告溯源)
 * @example console.log("[vis] version:", VISUAL_LIB_VERSION);
 */
export const VISUAL_LIB_VERSION = "2.0.0";

/**
 * 打印一张库信息名片 (开发环境调试用)
 * @example 在 App.tsx 入口调用：import { printLibraryCard } from "@/components/visualization"; printLibraryCard();
 */
export function printLibraryCard(): void {
  if (typeof console === "undefined") return;
  const card = `
┌─────────────────────────────────────────────────────────────┐
│  YYC³ Visualization Library  v${VISUAL_LIB_VERSION}                           │
├─────────────────────────────────────────────────────────────┤
│  主题:    Cyberpunk-88 (深色)  +  SunRise (亮色 WCAG AA)      │
│  校验:    Zod × 6 Schema (折线/柱/雷达/环形)                  │
│  降采样:  LTTB 4 档 (2000 / 10000 / 50000 阈值)              │
│  工具:    makeChartGradId / formatValueWithUnit / isEmpty    │
├─────────────────────────────────────────────────────────────┤
│  单一数据源原则: 所有组件通过 useVisualTheme() 取 tokens       │
│  五高架构: 高可用 / 高性能 / 高安全 / 高扩展 / 高智能          │
└─────────────────────────────────────────────────────────────┘
`;
  // eslint-disable-next-line no-console
  console.log(card);
}
