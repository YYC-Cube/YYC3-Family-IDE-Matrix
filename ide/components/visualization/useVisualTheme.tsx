/**
 * file: useVisualTheme.ts
 * description: 可视化主题 Context Provider + useVisualTheme Hook (SSR 同构无闪烁版 v2.0)
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v2.0.0
 * created: 2026-08-19
 * updated: 2026-08-19
 * status: active
 * tags: [hook],[context],[theme],[provider],[visualization],[ssr],[hydration]
 *
 * brief: 可视化主题切换的「单一数据源」· SSR 同构 + 零水合闪烁
 *
 * details:
 * v2.0 SSR 同构升级 (I-修复 · 参考 Experience 754686/576739):
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ 问题根源：                                                         │
 * │  服务端渲染不知道客户端 localStorage / matchMedia，              │
 * │  SSR 给稳定默认 cyberpunk88 → 客户端 hydration 时读 localStorage  │
 * │  发现用户上次是 sunrise → React 第一帧就发现 DOM text/class 不一致  │
 * │  → Hydration mismatch 报错 + 主题切换视觉闪烁 (FOUC)              │
 * ├────────────────────────────────────────────────────────────────────┤
 * │ 解决方案（三层防御，按效果从小到大）：                              │
 * │  ① Cookie 贯通：客户端 setThemeId 时同步写 Cookie，               │
 * │    下次请求 SSR 可直接从 Cookie 拿主题 → 真正 SSR=CSR 无闪烁       │
 * │  ② mounted gate：isClientMounted 在首渲染前一律用 initialThemeId  │
 * │    (SSR 出什么，客户端 hydration 第一帧就用什么)，                  │
 * │    useEffect 后再应用 localStorage/matchMedia → 平滑过渡不告警     │
 * │  ③ isMounted Hook：供 ThemeSwitcher 等受控组件消费，               │
 * │    mounted=false 时 return null/占位 → 避免 Switch aria-checked 翻 │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * v1.x 能力 (保留):
 * - 主题状态唯一来源: VisualThemeProvider (React Context)
 * - 所有图表通过 useVisualTheme() 读 tokens，禁止硬编码 theme 默认值
 * - 切换主题同步写 Context + localStorage + cookie(:30天)
 * - SSR / 非 Provider 环境: 静默降级 cyberpunk88 (不抛错)
 * - CSS vars 注入 :root，配合 html[data-vis-theme="xxx"] CSS 选择器
 *
 * 典型 SSR 用法:
 * ```
 * // Next.js App Router (page.tsx)
 * import { cookies } from "next/headers";
 * import { readThemeFromCookie, VisualThemeProvider } from "@/components/visualization";
 *
 * export default function RootLayout({ children }) {
 *   const cookieTheme = readThemeFromCookie(cookies().get("yyc3_visual_theme_v1")?.value);
 *   return (
 *     <html lang="zh-CN">
 *       <body>
 *         <VisualThemeProvider initialThemeId={cookieTheme}>
 *           {children}
 *         </VisualThemeProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * dependencies: react, ./theme (THEME_REGISTRY, ThemeId, VisualTokensType)
 * exports: VisualThemeProvider, useVisualTheme, VisualThemeContext,
 *          VisualThemeContextValue, VisualThemeProviderProps,
 *          useIsVisualThemeMounted,         // 消费方 ThemeSwitcher 防闪烁
 *          readThemeFromCookieString,        // SSR: 从 Cookie 字符串取主题
 *          COOKIE_VISUAL_THEME, SK_VISUAL_THEME
 * notes: 存储 key = yyc3_visual_theme_v1 (localStorage & Cookie 同名，便于 SSR 统一)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CYBERPUNK_88_THEME,
  THEME_REGISTRY,
  getThemeById,
  toCssVars,
  type ThemeId,
  type VisualTokensType,
} from "./theme";

// ==================================================================
// 0. 常量
// ==================================================================

/** localStorage & Cookie 共用同名 key，便于 SSR 贯通 */
const SK_VISUAL_THEME = "yyc3_visual_theme_v1";
/** Cookie key — 导出给 SSR 层 (Next.js cookies()) 用 */
export const COOKIE_VISUAL_THEME = SK_VISUAL_THEME;

/** Cookie 有效期 — 默认 30 天 (毫秒) */
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// ==================================================================
// 0.1 SSR 工具：Cookie 字符串 → ThemeId
// ==================================================================

/**
 * SSR/客户端通用：把任意来源的 cookie 值 (string | undefined | null) 安全解析为 ThemeId
 *
 *  - 不在 THEME_REGISTRY → null (调用方自行决定兜底 cyberpunk88)
 *  - 可直接传入 Next.js `cookies().get(COOKIE_VISUAL_THEME)?.value` 的结果
 *
 * @example
 *   // Next.js Server Component:
 *   const val = cookies().get(COOKIE_VISUAL_THEME)?.value;
 *   const themeId = readThemeFromCookieString(val) ?? "cyberpunk88";
 */
export function readThemeFromCookieString(raw: string | undefined | null): ThemeId | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed in THEME_REGISTRY) return trimmed as ThemeId;
  return null;
}

/**
 * 向后兼容别名 (更口语化的导出名)
 * 与 readThemeFromCookieString 语义完全相同。
 */
export const readThemeFromCookie = readThemeFromCookieString;

// ==================================================================
// 0.2 存储辅助 (localStorage + Cookie)
// ==================================================================

/** 从 localStorage 读取主题 ID (容错版 — 与 loadJSON 同策略) */
function readStoredThemeId(): ThemeId | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SK_VISUAL_THEME);
    if (!raw) return null;
    if (raw in THEME_REGISTRY) return raw as ThemeId;
    return null;
  } catch (_err) {
    return null;
  }
}

/** 写入 localStorage (容错版) */
function writeStoredThemeId(id: ThemeId): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(SK_VISUAL_THEME, id);
  } catch (_err) {
    /* quotaExceeded / 隐私模式 → 静默失败，Context 仍生效 */
  }
}

/**
 * 写入 Cookie (客户端 document.cookie 版)
 *  - SameSite=Lax：跨站安全，允许用户从外部链接跳转回站点时保留主题
 *  - Path=/：全站点生效
 *  - max-age=30d：长期记住
 *  - 不强制 Secure (本 IDE 支持 file:// + http://localhost 本地环境)
 */
function writeCookieThemeId(id: ThemeId): void {
  if (typeof document === "undefined") return;
  try {
    const maxAgeSec = Math.floor(COOKIE_MAX_AGE_MS / 1000);
    document.cookie =
      `${encodeURIComponent(SK_VISUAL_THEME)}=${encodeURIComponent(id)}` +
      `; path=/; SameSite=Lax; max-age=${maxAgeSec}`;
  } catch (_err) {
    /* 隐私模式 / 禁用 Cookie → 静默失败，localStorage 仍生效 */
  }
}

/** 检测系统偏好：深色 → cyberpunk88，非深色 → sunrise */
function detectSystemThemePref(): ThemeId {
  if (typeof window === "undefined" || !window.matchMedia) return "cyberpunk88";
  try {
    const darkMql = window.matchMedia("(prefers-color-scheme: dark)");
    return darkMql.matches ? "cyberpunk88" : "sunrise";
  } catch (_err) {
    return "cyberpunk88";
  }
}

// ==================================================================
// 1. Context 类型 & 实例
// ==================================================================

export interface VisualThemeContextValue {
  /** 当前主题 ID: cyberpunk88 (深色) | sunrise (亮色) */
  themeId: ThemeId;
  /** 当前主题完整 Tokens 对象 — 所有图表必须从这里读取颜色/尺寸 */
  tokens: VisualTokensType;
  /** 切换主题 ID (同步写 localStorage + Cookie + :root CSS vars) */
  setThemeId: (id: ThemeId) => void;
  /** 切换到下一个主题 — 适合 Toggle 按钮 (cyberpunk88 ↔ sunrise) */
  toggleTheme: () => void;
  /** true = 亮色, false = 深色 (语义化快捷判断) */
  isLight: boolean;
  /**
   * 客户端是否已完成首次水合
   * I-修复: 消费方 ThemeSwitcher 用 mounted gate 避免 Switch aria-checked 首屏翻转
   *  - SSR 期间 & hydration 第一帧 → false
   *  - useEffect 触发后 (客户端真正接管 DOM) → true
   */
  isMounted: boolean;
}

/** 默认 fallback 值 — 不提供 Provider 时的静默降级兜底 (cyberpunk88) */
const FALLBACK_CTX: VisualThemeContextValue = {
  themeId: "cyberpunk88",
  tokens: CYBERPUNK_88_THEME,
  setThemeId: () => {
    if (typeof console !== "undefined") {
      console.warn(
        "[useVisualTheme] setThemeId called outside VisualThemeProvider. " +
          "Wrap your app root with <VisualThemeProvider> to enable persistence."
      );
    }
  },
  toggleTheme: () => {
    if (typeof console !== "undefined") {
      console.warn("[useVisualTheme] toggleTheme called outside VisualThemeProvider.");
    }
  },
  isLight: false,
  isMounted: false,
};

export const VisualThemeContext = createContext<VisualThemeContextValue>(FALLBACK_CTX);

// ==================================================================
// 2. Provider 组件
// ==================================================================

export interface VisualThemeProviderProps {
  children: ReactNode;
  /**
   * 强制指定初始主题 (SSR 同构用，优先级最高)
   *  - 推荐 SSR 场景：从 Cookie 读取主题后直接传入 → 零闪烁
   *  - 如果不传：SSR + hydration 第一帧统一 cyberpunk88 兜底，
   *    mounted 后再自动应用 localStorage/matchMedia (轻微渐变过渡可接受)
   */
  initialThemeId?: ThemeId;
  /**
   *  (可选高级) 完全关闭 mounted-gate 自动同步：
   *  - 设为 true 则会在 useState initializer 阶段直接读 localStorage/matchMedia
   *  - 仅在确认 100% CSR 场景 (Electron / file:// / 纯 SPA) 下开启
   *  - 默认 false — 安全 SSR 兼容
   */
  disableMountedGate?: boolean;
}

/**
 * 可视化主题 Provider — 必须放在应用根节点 (App.tsx)
 * 负责：初始化主题、CSS vars 注入 :root、Cookie/localStorage 双写
 */
export function VisualThemeProvider(props: VisualThemeProviderProps) {
  const { children, initialThemeId, disableMountedGate = false } = props;

  // I-修复·策略核心：
  //   SSR + hydration 第一帧 → stableThemeId = initialThemeId ?? cyberpunk88
  //   (SSR 渲染什么，客户端第一次 render 就必须渲染什么 → 无 mismatch)
  //   useEffect 后 → 自动读 localStorage/matchMedia，平滑过渡到用户偏好
  const resolveStableInitial = (): ThemeId => {
    if (initialThemeId && initialThemeId in THEME_REGISTRY) return initialThemeId;
    // 完全关闭 mounted gate 时，允许首帧直接读 localStorage/matchMedia (Electron/纯 SPA)
    if (disableMountedGate) {
      const stored = readStoredThemeId();
      if (stored) return stored;
      return detectSystemThemePref();
    }
    return "cyberpunk88";
  };

  const [themeId, setThemeIdState] = useState<ThemeId>(resolveStableInitial);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // I-修复·挂载后：从 localStorage / 系统偏好 同步真实主题
  // 这样 SSR 与 hydration 第一帧完全一致 → useEffect 后才切换到用户真实偏好
  useEffect(() => {
    // 客户端接管 DOM 完成，标记 mounted
    setIsMounted(true);

    // 如果消费方已经通过 initialThemeId 显式指定了主题，
    // 认为其已经与 SSR Cookie 对齐 → 不再重复覆盖
    if (initialThemeId && initialThemeId in THEME_REGISTRY) {
      return;
    }

    // mounted gate 开启 (默认) 时：首次挂载后自动应用本地存储 + 系统偏好
    if (!disableMountedGate) {
      const stored = readStoredThemeId();
      if (stored) {
        setThemeIdState(stored);
        return;
      }
      const sysPref = detectSystemThemePref();
      setThemeIdState(sysPref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (2) 按 ID 解析 tokens (带兜底)
  const tokens = useMemo<VisualTokensType>(() => getThemeById(themeId), [themeId]);

  // (3) 派生语义：isLight
  const isLight = useMemo(() => themeId === "sunrise", [themeId]);

  // (4) 切换主题：写 state + localStorage + Cookie 三处同步 (I-修复)
  const setThemeId = useCallback((id: ThemeId) => {
    const safe = id in THEME_REGISTRY ? id : "cyberpunk88";
    setThemeIdState(safe);
    writeStoredThemeId(safe);
    writeCookieThemeId(safe); // SSR 贯通：下次请求服务端就能从 Cookie 取主题
  }, []);

  // (5) 主题循环切换 (cyberpunk88 ↔ sunrise)
  const toggleTheme = useCallback(() => {
    setThemeId(themeId === "sunrise" ? "cyberpunk88" : "sunrise");
  }, [themeId, setThemeId]);

  // (6) 把 CSS vars 注入到 document.documentElement (:root)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const vars = toCssVars(tokens);
    const appliedKeys: string[] = [];
    Object.entries(vars).forEach(([k, v]) => {
      root.style.setProperty(k, v);
      appliedKeys.push(k);
    });
    // 标记 data 属性方便 CSS 选择器: html[data-vis-theme="sunrise"] .xxx {}
    root.setAttribute("data-vis-theme", themeId);
    // Cleanup：组件卸载或主题切换时清理旧 CSS vars（防止 CSS var 泄漏）
    return () => {
      appliedKeys.forEach((k) => {
        try { root.style.removeProperty(k); } catch { /* ignore */ }
      });
    };
  }, [tokens, themeId]);

  // (7) Context Value (memo 化，避免无谓重渲染)
  const ctxValue = useMemo<VisualThemeContextValue>(
    () => ({
      themeId,
      tokens,
      setThemeId,
      toggleTheme,
      isLight,
      isMounted,
    }),
    [themeId, tokens, setThemeId, toggleTheme, isLight, isLight]
  );

  return (
    <VisualThemeContext.Provider value={ctxValue}>
      {children}
    </VisualThemeContext.Provider>
  );
}

// ==================================================================
// 3. Hook (主要消费 API)
// ==================================================================

/**
 * 可视化主题 Hook — 图表组件读取主题的唯一入口 (单一数据源原则)
 *
 * 注意：使用方不需要做 null 判断 / try-catch，
 *       如果未包裹 Provider，会自动静默降级为 cyberpunk88 且 console.warn 一次
 */
export function useVisualTheme(): VisualThemeContextValue {
  return useContext(VisualThemeContext);
}

/**
 * ThemeSwitcher / 受控组件专用 — 读取 mounted 状态 (避免 hydration 翻转闪烁)
 *
 * @example
 * function ThemeSwitcherButton() {
 *   const { themeId, setThemeId, isMounted } = useVisualTheme();
 *   // 未挂载：只展示空占位 / 灰色不可用，不参与 hydration 对比
 *   if (!isMounted) return <button disabled>🎨 主题…</button>;
 *   return (
 *     <Switch
 *       checked={themeId === "sunrise"}
 *       onCheckedChange={(c) => setThemeId(c ? "sunrise" : "cyberpunk88")}
 *     />
 *   );
 * }
 */
export function useIsVisualThemeMounted(): boolean {
  return useContext(VisualThemeContext).isMounted;
}
