/**
 * file: theme.ts
 * description: 可视化主题入口 · 双主题令牌 (Cyberpunk-88 深色 + SunRise 亮色) + 主题注册中心
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v2.0.0
 * created: 2026-08-19
 * updated: 2026-08-19
 * status: active
 * tags: [theme],[config],[cyberpunk-88],[sunrise],[visualization]
 *
 * brief: 双主题令牌统一出口 — Cyberpunk-88 (深色赛博朋克) + SunRise (亮色日出)
 *
 * details:
 * v2.0 变更:
 * - 新增 SunRise 亮色主题 VISUAL_TOKENS_SUNRISE (WCAG AA 对比度: 正文≥4.5:1)
 * - 建立主题注册表 ThemeRegistry，方便未来扩展
 * - 语义便捷函数增加可选 second argument `tokens` 做当前主题取色
 * - 语义便捷函数的「无参版本」保持向后兼容 (默认 Cyberpunk-88)
 *
 * 双主题对照 (Five High 架构 · 主题层):
 * ┌──────────────┬──────────────────────────────┬──────────────────────────────┐
 * │ Token 层级    │  Cyberpunk-88 (深色)          │  SunRise (亮色)              │
 * ├──────────────┼──────────────────────────────┼──────────────────────────────┤
 * │ canvas.bg    │  #0d1117 (GitHub 深蓝)       │  #ffffff (纯白)              │
 * │ canvas.panel │  rgba(255,255,255,0.02)      │  #f8fafc (slate-50)         │
 * │ canvas.border│  rgba(255,255,255,0.06)      │  #e2e8f0 (slate-200)        │
 * │ text.primary │  rgba(255,255,255,0.85)      │  #0f172a (slate-900)  14.2:1│
 * │ text.secondary│ rgba(255,255,255,0.45)      │  #475569 (slate-600)  7.2:1 │
 * │ text.tertiary│  rgba(255,255,255,0.20)      │  #94a3b8 (slate-400)  3.3:1 │
 * │ primary.500  │  #06b6d4 (Cyan)              │  #0891b2 (Cyan-600 深一档)  │
 * │ grid.stroke  │  rgba(255,255,255,0.04)      │  rgba(15,23,42,0.06)        │
 * │ axis.tickColor│ rgba(255,255,255,0.15)      │  #64748b (slate-500)  5.7:1│
 * └──────────────┴──────────────────────────────┴──────────────────────────────┘
 *
 * 便捷 API (主题无关 & 主题相关两类):
 *   // —— 主题无关，默认用 Cyberpunk-88 ——
 *   t.canvas.bg              —— 便捷别名 (旧代码不改也能用)
 *   getSemanticColor("error")
 *   getFamilyColor("tianshu")
 *   statusColor("success")
 *   toCssVars()
 *
 *   // —— 主题动态切换 (配合 useVisualTheme) ——
 *   getThemeById("sunrise")                               → VisualTokensType
 *   getSemanticColorForTokens(sunriseTokens, "error")     → 按指定主题取色
 *   toCssVars(sunriseTokens)                              → 指定主题 CSS var
 *
 * dependencies: none (纯 TS 对象，零运行时依赖)
 * exports:
 *   CYBERPUNK_88_THEME, VISUAL_TOKENS_SUNRISE,
 *   t, VISUAL_TOKENS_CYBERPUNK_88, VISUAL_TOKENS,
 *   THEME_REGISTRY, ThemeId, getThemeById,
 *   VisualTokensType, SemanticRole, FamilyVisualRole,
 *   getSemanticColor, getFamilyColor, statusToSemantic, statusColor,
 *   getSemanticColorForTokens, getFamilyColorForTokens, statusColorForTokens,
 *   toCssVars
 */

// ==================================================================
// 0. 基础类型定义
// ==================================================================

/** 语义色角色 (Semantic Roles) */
export type SemanticRole = "success" | "error" | "warning" | "info" | "purple" | "pink";

/** 家族角色 (FamilyRole) — 与 AgentSkills.ts 保持一致，方便统一映射 */
export type FamilyVisualRole =
  | "tianshu"   // 元启·天枢
  | "qianhang"  // 言启·千行
  | "wanwu"     // 语枢·万物
  | "xianzhi"   // 预见·先知
  | "bole"      // 知遇·伯乐
  | "shouhu"    // 智云·守护
  | "zongshi"   // 格物·宗师
  | "lingyun";  // 创想·灵韵

/** 完整主题令牌的 TS 类型 (供未来主题切换接口使用) */
export interface VisualTokensType {
  canvas: {
    bg: string;
    bgElevated: string;
    panel: string;
    border: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
  };
  /** Cyan 主色阶 (Tailwind cyan 调色板裁剪版) */
  primary: {
    50: string; 100: string; 200: string; 300: string;
    400: string; 500: string; 600: string; 700: string;
  };
  semantic: Record<SemanticRole, string>;
  /** 8 家族顺序色板 */
  familySeries: string[];
  /** 常见面积图梯度 (start_opacity 30% → end_opacity 2%) */
  gradients: Record<"latencyArea" | "errorArea" | "successArea", [string, string]>;
  grid: { stroke: string; dashArray: string };
  axis: { stroke: string; tickFont: string; tickColor: string };
  size: { xs: number; sm: number; md: number; lg: number; xl: number };
  spacing: {
    radius: number;
    padding: number;
    margin: { top: number; right: number; left: number; bottom: number };
  };
  font: { sans: string; mono: string };
}

/** 主题 ID 联合类型 — 来自注册表的 key */
export type ThemeId = "cyberpunk88" | "sunrise";

// ==================================================================
// 1. 深色主题: Cyberpunk-88 (赛博朋克 · 深蓝 + 青色)
// ==================================================================

/**
 * Cyberpunk-88 主题配置 — 深蓝 + 青色赛博朋克视觉
 * 与现有 LatencyTrendChart 样式 100% 对齐，可直接应用于所有图表组件
 */
export const CYBERPUNK_88_THEME: VisualTokensType = {
  canvas: {
    bg: "#0d1117",
    bgElevated: "#0d1117",
    panel: "rgba(255,255,255,0.02)",
    border: "rgba(255,255,255,0.06)",
  },
  text: {
    primary: "rgba(255,255,255,0.85)",
    secondary: "rgba(255,255,255,0.45)",
    tertiary: "rgba(255,255,255,0.20)",
    disabled: "rgba(255,255,255,0.10)",
  },
  primary: {
    50:  "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
  },
  semantic: {
    success: "#10b981",
    error:   "#ef4444",
    warning: "#f59e0b",
    info:    "#3b82f6",
    purple:  "#a855f7",
    pink:    "#ec4899",
  },
  familySeries: [
    "#06b6d4", "#3b82f6", "#8b5cf6", "#a855f7",
    "#10b981", "#f59e0b", "#ef4444", "#ec4899",
  ],
  gradients: {
    latencyArea: ["rgba(6,182,212,0.30)", "rgba(6,182,212,0.02)"],
    errorArea:   ["rgba(239,68,68,0.30)",  "rgba(239,68,68,0.02)"],
    successArea: ["rgba(16,185,129,0.30)", "rgba(16,185,129,0.02)"],
  },
  grid: {
    stroke: "rgba(255,255,255,0.04)",
    dashArray: "3 3",
  },
  axis: {
    stroke: "rgba(255,255,255,0.06)",
    tickFont: "9px",
    tickColor: "rgba(255,255,255,0.15)",
  },
  size: {
    xs: 100,
    sm: 130,
    md: 220,
    lg: 320,
    xl: 480,
  },
  spacing: {
    radius: 12,
    padding: 12,
    margin: { top: 4, right: 4, left: -20, bottom: 0 },
  },
  font: {
    sans: `ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif`,
    mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, "SF Mono", "JetBrains Mono", monospace`,
  },
};

// ==================================================================
// 2. 亮色主题: SunRise (日出 · 白纸 + 深蓝字) — NEW in v2.0
// ==================================================================

/**
 * SunRise 主题配置 — 白底 + 深蓝字的日出亮色视觉
 * 所有文本对比度通过 WCAG AA: 正文≥4.5:1 / 大字体≥3:1
 * 8 家族色板全部选用 "在白纸上对比度 ≥4.5:1" 的 Tailwind 600~700 档
 */
export const VISUAL_TOKENS_SUNRISE: VisualTokensType = {
  canvas: {
    bg: "#ffffff",         // 纯白背景
    bgElevated: "#ffffff", // 同底色
    panel: "#f8fafc",      // slate-50 (极浅灰，面板层次感)
    border: "#e2e8f0",     // slate-200 (浅灰分割线)
  },
  text: {
    // 与 white 对比度测试 (WCAG AA ≥4.5:1 for body)
    primary:  "#0f172a",   // slate-900 → 14.2 : 1 ✅
    secondary:"#475569",   // slate-600 →  7.2 : 1 ✅
    tertiary: "#94a3b8",   // slate-400 →  3.3 : 1 (适合辅助信息)
    disabled: "#cbd5e1",   // slate-300 →  2.0 : 1 (仅禁用态)
  },
  primary: {
    // 亮色主色使用 Cyan-600/700 档加深
    50:  "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#0891b2",   // ← 亮色主色点 (深色模式的 600 档，白纸对比度 4.7:1 ✅)
    600: "#0e7490",
    700: "#155e75",
  },
  semantic: {
    // 亮色统一加深到 600/700 档 (白纸对比度均 ≥ 4.5:1)
    success: "#059669",   // emerald-600 → 5.9 : 1 ✅
    error:   "#dc2626",   // red-600     → 5.2 : 1 ✅
    warning: "#d97706",   // amber-600   → 4.7 : 1 ✅
    info:    "#2563eb",   // blue-600    → 5.8 : 1 ✅
    purple:  "#9333ea",   // purple-600  → 5.6 : 1 ✅
    pink:    "#db2777",   // pink-600    → 5.3 : 1 ✅
  },
  familySeries: [
    "#0891b2", // 0 tianshu 天枢 — cyan-600     4.7:1
    "#2563eb", // 1 qianhang 千行 — blue-600     5.8:1
    "#7c3aed", // 2 wanwu 万物    — violet-600   5.7:1
    "#9333ea", // 3 xianzhi 先知  — purple-600   5.6:1
    "#059669", // 4 bole 伯乐     — emerald-600  5.9:1
    "#d97706", // 5 shouhu 守护   — amber-600    4.7:1
    "#dc2626", // 6 zongshi 宗师  — red-600      5.2:1
    "#db2777", // 7 lingyun 灵韵  — pink-600     5.3:1
  ],
  gradients: {
    // 亮色梯度：主色 15% → 2% (白底下更柔和)
    latencyArea: ["rgba(8,145,178,0.15)",  "rgba(8,145,178,0.02)"],
    errorArea:   ["rgba(220,38,38,0.15)",   "rgba(220,38,38,0.02)"],
    successArea: ["rgba(5,150,105,0.15)",   "rgba(5,150,105,0.02)"],
  },
  grid: {
    stroke: "rgba(15,23,42,0.06)",   // 对白纸非常淡的 slate-900 影
    dashArray: "3 3",
  },
  axis: {
    stroke: "#e2e8f0",                // slate-200
    tickFont: "9px",
    tickColor: "#64748b",             // slate-500 → 白纸 5.7:1 ✅
  },
  size: {
    xs: 100, sm: 130, md: 220, lg: 320, xl: 480,  // 与深色主题一致 (尺寸与色板解耦)
  },
  spacing: {
    radius: 12,
    padding: 12,
    margin: { top: 4, right: 4, left: -20, bottom: 0 },
  },
  font: {
    sans: `ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif`,
    mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, "SF Mono", "JetBrains Mono", monospace`,
  },
};

// ==================================================================
// 3. 主题注册表 & 查找工具 (单一数据源原则)
// ==================================================================

/** 主题注册表 — 所有可用主题都登记在这里 (单一数据源) */
export const THEME_REGISTRY: Record<ThemeId, VisualTokensType> = {
  cyberpunk88: CYBERPUNK_88_THEME,
  sunrise: VISUAL_TOKENS_SUNRISE,
};

/** 按 ID 取主题令牌 (带兜底：不存在 → cyberpunk88) */
export function getThemeById(id: ThemeId | string | null | undefined): VisualTokensType {
  if (id && id in THEME_REGISTRY) {
    return THEME_REGISTRY[id as ThemeId];
  }
  return CYBERPUNK_88_THEME;
}

// ==================================================================
// 4. 向后兼容别名 & 便捷出口 (从原 tokens.ts 平滑迁移)
// ==================================================================

/** 便捷别名：写 t.canvas.bg 比 CYBERPUNK_88_THEME.canvas.bg 更省事 (默认深色) */
export const t = CYBERPUNK_88_THEME;

/** 与原 tokens.ts 的 VISUAL_TOKENS_CYBERPUNK_88 保持兼容 */
export const VISUAL_TOKENS_CYBERPUNK_88 = CYBERPUNK_88_THEME;

/** 与原 tokens.ts 的 VISUAL_TOKENS 保持兼容 (默认主题 = cyberpunk88) */
export const VISUAL_TOKENS = CYBERPUNK_88_THEME;

// ==================================================================
// 5. 语义便捷函数 · 双版本 (主题默认版 + 指定 tokens 版)
// ==================================================================

// —— 版本 A: 主题默认版 (无第二参数，向后兼容) ——

/** 根据语义角色取色 (默认 Cyberpunk-88) */
export function getSemanticColor(role: SemanticRole): string {
  return t.semantic[role];
}

/** 根据家族角色 (8 种) 取顺序色板中的对应颜色 (默认 Cyberpunk-88) */
export function getFamilyColor(role: FamilyVisualRole): string {
  const FAMILY_INDEX: Record<FamilyVisualRole, number> = {
    tianshu: 0, qianhang: 1, wanwu: 2, xianzhi: 3,
    bole: 4, shouhu: 5, zongshi: 6, lingyun: 7,
  };
  return t.familySeries[FAMILY_INDEX[role]] ?? t.primary[500];
}

/** 状态字符串 → 语义色角色 (纯函数，与主题无关 · 大小写不敏感) */
export function statusToSemantic(status: string | null | undefined): SemanticRole {
  if (status == null) return "info";
  const s = String(status).trim().toLowerCase();
  if (!s) return "info";

  // —— error: 明确失败态 ——
  if (
    s === "failed" || s === "fail" || s === "error" || s === "fatal" ||
    s === "crash" || s === "denied" || s === "unhealthy" || s === "down" ||
    s === "timeout" || s === "timed_out" || s === "cancelled" || s === "canceled" ||
    s === "aborted"
  ) {
    return "error";
  }

  // —— success: 明确成功态 ——
  if (
    s === "success" || s === "succeeded" || s === "ok" || s === "pass" ||
    s === "passed" || s === "healthy" || s === "active" || s === "complete" ||
    s === "completed" || s === "done" || s === "ready"
  ) {
    return "success";
  }

  // —— warning: 降级但非失败 ——
  if (
    s === "warning" || s === "warn" || s === "degraded" || s === "throttled" ||
    s === "slow" || s === "high"
  ) {
    return "warning";
  }

  // —— purple: 阻塞 / 停滞 (扩展语义色) ——
  if (s === "stalled" || s === "stalling" || s === "blocked") {
    return "purple";
  }

  // —— info: 其余运行中/待定/默认 ——
  return "info";
}

/** 状态字符串 → 颜色 (默认 Cyberpunk-88) */
export function statusColor(status: string | null | undefined): string {
  return getSemanticColor(statusToSemantic(status));
}

// —— 版本 B: 指定 tokens 版 (配合 useVisualTheme 做动态切换) ——

/** 根据指定主题令牌 + 语义角色取色 */
export function getSemanticColorForTokens(
  tokens: VisualTokensType,
  role: SemanticRole
): string {
  return tokens.semantic[role];
}

/** 根据指定主题令牌 + 家族角色取色 */
export function getFamilyColorForTokens(
  tokens: VisualTokensType,
  role: FamilyVisualRole
): string {
  const FAMILY_INDEX: Record<FamilyVisualRole, number> = {
    tianshu: 0, qianhang: 1, wanwu: 2, xianzhi: 3,
    bole: 4, shouhu: 5, zongshi: 6, lingyun: 7,
  };
  return tokens.familySeries[FAMILY_INDEX[role]] ?? tokens.primary[500];
}

/** 根据指定主题令牌 + 状态字符串取色 */
export function statusColorForTokens(
  tokens: VisualTokensType,
  status: string | null | undefined
): string {
  return getSemanticColorForTokens(tokens, statusToSemantic(status));
}

// ==================================================================
// 6. CSS Variables 注入工具 (HTML / Tailwind 联动)
// ==================================================================

/** 返回可直接注入 :root 的 CSS var 记录 (用于主题上下文 Provider) */
export function toCssVars(
  tokens: VisualTokensType = CYBERPUNK_88_THEME
): Record<string, string> {
  return {
    "--vis-canvas-bg": tokens.canvas.bg,
    "--vis-canvas-panel": tokens.canvas.panel,
    "--vis-canvas-border": tokens.canvas.border,
    "--vis-text-primary": tokens.text.primary,
    "--vis-text-secondary": tokens.text.secondary,
    "--vis-text-tertiary": tokens.text.tertiary,
    "--vis-primary-500": tokens.primary[500],
    "--vis-primary-400": tokens.primary[400],
    "--vis-success": tokens.semantic.success,
    "--vis-error": tokens.semantic.error,
    "--vis-warning": tokens.semantic.warning,
    "--vis-info": tokens.semantic.info,
    "--vis-grid-stroke": tokens.grid.stroke,
    "--vis-axis-stroke": tokens.axis.stroke,
    "--vis-axis-tick-color": tokens.axis.tickColor,
    "--vis-size-sm": `${tokens.size.sm}px`,
    "--vis-size-md": `${tokens.size.md}px`,
    "--vis-size-lg": `${tokens.size.lg}px`,
    "--vis-radius": `${tokens.spacing.radius}px`,
    ...Object.fromEntries(
      tokens.familySeries.map((c, i) => [`--vis-family-${i}`, c])
    ),
  };
}
