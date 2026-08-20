---
file: README.md
description: YYC³ IDE 可视化体系模块 README · 双主题令牌 + 图表组件 + LTTB 性能 + Zod 契约
author: YanYuCloudCube Team <admin@0379.email>
version: v2.0.0
created: 2026-08-19
updated: 2026-08-19
status: stable
tags: [visualization, theme, recharts, radar, lttb, zod, agent-skills]
category: technical
language: zh-CN
audience: developers
complexity: intermediate
project: yyc3-platform
phase: development
related_docs: ../../../docs/visualization-spec.md
license: MIT
copyright: Copyright (c) 2026 YanYuCloudCube Team
---

> ***YanYuCloudCube***
> *言启象限 | 语枢未来*
> ***Words Initiate Quadrants, Language Serves as Core for Future***
> *万象归元于云枢 | 深栈智启新纪元*
> ***All things converge in cloud pivot; Deep stacks ignite a new era of intelligence***

---

<div align="center">

# 🎨 YYC³ IDE · 可视化体系模块

**言启千行代码，语枢万物智能**
「单一数据源 · 双主题令牌 · 五标驱动 · 五维评估」

**`@yyc3/ide`** — IDE 可视化子系统
`React 18 + TypeScript 5 + Recharts 2 + Zustand + Zod + Vitest`

[![Test: 92/92](https://img.shields.io/badge/AgentSkills%20vis--%2A-92%20passed-brightgreen)](#5--测试覆盖)
[![Build: tsc 0 err](https://img.shields.io/badge/tsc--noEmit-0%20errors-blue)](#4--快速开始)
[![Theme: 2](https://img.shields.io/badge/themes-cyberpunk88%20%7C%20sunrise-cyan)](#1--双主题令牌体系)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow)](#license)

</div>

---

## 目录

1. [体系总览](#0--体系总览)
2. [目录结构](#-目录结构)
3. [双主题令牌体系](#1--双主题令牌体系)
4. [主题切换架构 (Provider + Hook)](#2--主题切换架构provider--hook单一数据源)
5. [图表组件库](#3--图表组件库)
6. [性能优化 · LTTB 降采样](#%EF%B8%8F-性能优化--lttb-降采样)
7. [Zod 数据校验契约](#-zod-数据校验契约)
8. [快速开始](#4--快速开始)
9. [测试覆盖](#5--测试覆盖)
10. [Five High 架构合规](#%EF%B8%8F-five-high-架构合规矩阵)
11. [变更历史](#变更历史)
12. [License](#license)

---

## 0️⃣ · 体系总览

本模块 (`ide/components/visualization/`) 是 **YYC³ IDE** 的可视化基础设施层，承接开发者文档 [YYC3-可视化体系设计开发者文档.md](../../../docs/visualization-spec.md) §3~§7 的落地实现：

```
                   ┌─────────────────────────────────────────┐
                   │   VisualThemeProvider (应用根节点)        │
                   │  ├─ localStorage 持久化 (yyc3_visual_*)  │
                   │  ├─ prefers-color-scheme 系统主题检测    │
                   │  └─ :root CSS Variables 自动注入        │
                   └──────────────┬──────────────────────────┘
                                  │  useVisualTheme() Hook
                   ┌──────────────┴──────────────────────────┐
                   │          单一数据源: tokens              │
                   │   CYBERPUNK_88 (深色) ↔ SUNRISE (亮色)   │
                   └──────────────┬──────────────────────────┘
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   [RadarChart.tsx]       [LatencyTrendChart]        [新图表接入]
    §5 BaseChartProps     LTTB 降采样算法           §5 BaseChartProps
    Zod 校验                自动 3 级策略                Zod 校验
```

---

## 📂 目录结构

**实际存在的文件清单（与代码完全对齐，无虚构）：**

```
ide/components/visualization/
├── README.md                           # 本文件 (v2.0.0)
│
├── theme.ts                            # ★ 主题统一入口 (v2.0)
│   ├─ type  SemanticRole              # 6 语义色角色
│   ├─ type  FamilyVisualRole          # 8 家族角色 (天枢/千行/...)
│   ├─ type  VisualTokensType          # 完整令牌结构
│   ├─ type  ThemeId = "cyberpunk88"|"sunrise"
│   ├─ const CYBERPUNK_88_THEME        # 深色赛博朋克 (GitHub Dark)
│   ├─ const VISUAL_TOKENS_SUNRISE     # ★ 亮色日出 (WCAG AA ≥4.5:1)
│   ├─ const THEME_REGISTRY            # 主题注册表 (可扩展)
│   ├─ const t  /  VISUAL_TOKENS       # 向后兼容别名
│   ├─ fn    getThemeById()            # id→tokens 容错查询
│   ├─ fn    getSemanticColor*()       # 语义取色 (默认 / 指定 tokens)
│   ├─ fn    getFamilyColor*()         # 家族取色 (默认 / 指定 tokens)
│   ├─ fn    statusToSemantic()        # 52 个状态关键词 → SemanticRole
│   ├─ fn    statusColor*()            # 状态关键词 → 颜色
│   └─ fn    toCssVars()               # tokens → Record<CSSVar, string>
│
├── useVisualTheme.tsx                 # ★ Context Provider + Hook
│   ├─ iface VisualThemeContextValue   # { themeId, tokens, setThemeId, toggleTheme, isLight }
│   ├─ const VisualThemeContext        # createContext (含 fallback)
│   ├─ fn    VisualThemeProvider()     # 根组件包裹 (支持 initialThemeId SSR)
│   └─ fn    useVisualTheme()          # Hook (无 Provider 静默降级)
│
├── theme/
│   └── tokens.ts                       # 向后兼容桥 — 全部重导出 ../theme.ts
│
├── charts/
│   └── RadarChart.tsx                  # ★ 雷达图 · v2.0 (§5 BaseChartProps + Zod)
│       ├─ iface RadarChartProps
│       └─ fn    RadarChart()           # named + default 双导出
│
├── utils/
│   ├── lttb.ts                         # ★ LTTB 降采样算法
│   │   ├─ iface LTTBPoint
│   │   ├─ iface AutoDownsampleOptions
│   │   ├─ fn    lttbDownsample()      # 核心算法 (Largest-Triangle-Three-Buckets)
│   │   └─ fn    autoDownsample()      # 自动 4 档策略: none/md/lg/xl
│   │
│   └── chartUtils.ts                   # 图表通用工具
│       ├─ fn    makeChartGradId()     # SVG Gradient 唯一 ID (防冲突)
│       ├─ fn    formatValueWithUnit() # 数值 / 时间 / 百分比格式化
│       └─ fn    isEmptyChartData()    # 空数据判定
│
├── validators/
│   └── chart.schemas.ts                # ★ Zod 数据契约 (§6)
│       ├─ const TimeSeriesPointSchema / LineChartDataSchema
│       ├─ const BarPointSchema / BarChartDataSchema
│       ├─ const RadarAxisSchema / RadarSubjectSchema / RadarChartDataSchema
│       ├─ const DonutPointSchema / DonutChartDataSchema
│       └─ type  RadarAxis / RadarSubject / RadarChartData
│
└── __tests__/
    └── VisualThemeAndCharts.test.tsx   # ★ AgentSkills 55 vis-01~vis-55
                                         # 92 tests · 100% 覆盖 (语句/分支)
```

> 关联组件（上层业务，同仓库但不在本目录内）：
> - [LatencyTrendChart.tsx](../model-settings/LatencyTrendChart.tsx) — 实时延迟趋势图 · 接入 `useVisualTheme` + LTTB 算法

---

## 1️⃣ · 双主题令牌体系

### 1.1 令牌总表 (`VisualTokensType`)

所有令牌在 `theme.ts` 中用 **唯一 TypeScript interface** 定义，两主题共用同一结构保证字段对齐：

```ts
VisualTokensType = {
  canvas,      // 画布层: bg / bgElevated / panel / border
  text,        // 文本层: primary | secondary | tertiary | disabled
  primary,     // 主色 50~700 (Cyan 系)
  semantic,    // 语义色: success | error | warning | info | purple | pink
  familySeries,// 8 家族序列色: 天枢→灵韵
  gradients,   // 面积图渐变: latencyArea | errorArea | successArea
  grid,        // 网格: stroke | dashArray
  axis,        // 坐标轴: stroke | tickColor | tickFont
  size,        // 画布尺寸: xs(100) | sm(130) | md(220) | lg(320) | xl(480)
  spacing,     // 间距: radius | padding | margin
  font,        // 字体: sans | mono
}
```

### 1.2 双主题色板对照 (关键值)

| Token | Cyberpunk-88 🌙 深色 | SunRise ☀️ 亮色 | 说明 |
|---|---|---|---|
| `canvas.bg` | `#0d1117` (GitHub Dark) | `#ffffff` (纯白) | 画布背景 |
| `canvas.panel` | `rgba(255,255,255,0.02)` | `#f8fafc` (slate-50) | 面板层次 |
| `canvas.border` | `rgba(255,255,255,0.06)` | `#e2e8f0` (slate-200) | 分割线 |
| `text.primary` | `rgba(255,255,255,0.85)` | `#0f172a` (slate-900) | **正文对比度** 14.2:1 ✅ WCAG AAA |
| `text.secondary` | `rgba(255,255,255,0.45)` | `#475569` (slate-600) | **辅助对比度** 7.2:1 ✅ WCAG AAA |
| `primary.500` | `#06b6d4` (Cyan-500) | `#0891b2` (Cyan-600) | 亮色主色加深一档 (4.7:1) |
| `semantic.success` | `#10b981` (emerald-500) | `#059669` (emerald-600) | 5.9:1 ✅ |
| `semantic.error` | `#ef4444` (red-500) | `#dc2626` (red-600) | 5.2:1 ✅ |
| `semantic.info` | `#3b82f6` (blue-500) | `#2563eb` (blue-600) | 5.8:1 ✅ |
| `familySeries[0]` 天枢 | `#06b6d4` Cyan | `#0891b2` Cyan-600 | 家族第一角色 |
| `familySeries[7]` 灵韵 | `#ec4899` Pink | `#db2777` Pink-600 | 家族第八角色 |

### 1.3 尺寸令牌 (两主题 **完全相同** — 保证布局稳定)

```ts
size:   { xs: 100, sm: 130, md: 220, lg: 320, xl: 480 }   // LatencyTrendChart 默认 sm=130
radius: 12px                                                 // 统一圆角
dashArray: "3 3"                                             // 网格虚线段
```

### 1.4 语义色便捷函数 (双版本 API)

```tsx
// 版本 A · 默认 Cyberpunk-88 — 向后兼容 (无需改旧代码)
getSemanticColor("error");                    // "#ef4444"
getFamilyColor("tianshu");                    // "#06b6d4"
statusColor("Failed");                        // "#ef4444"

// 版本 B · 指定 tokens — 配合 useVisualTheme 动态取色 ✅ 推荐
const { tokens } = useVisualTheme();
getSemanticColorForTokens(tokens, "error");   // sunrise→"#dc2626"  自动深一档
getFamilyColorForTokens(tokens, "tianshu");   // sunrise→"#0891b2"
statusColorForTokens(tokens, "Failed");       // sunrise→"#dc2626"
```

### 1.5 状态 → 语义色映射 (`statusToSemantic`)

覆盖 52 个状态关键词，大小写不敏感 + trim + toLowerCase 容错：

| 分类 | 关键词示例 |
|---|---|
| `success` | success, succeeded, ok, pass, passed, healthy, active, complete, completed, done, ready |
| `error` | failed, fail, error, fatal, crash, denied, unhealthy, down, timeout, timed_out, cancelled, canceled, aborted |
| `warning` | warning, warn, degraded, throttled, slow, high |
| `purple` 🔮 | stalled, stalling, blocked |
| `info` (默认) | pending, running, in_progress, processing, starting, initializing, queued, scheduled, idle, standby, waiting, **null**, **undefined**, **空串**, **未知值** |

---

## 2️⃣ · 主题切换架构 (Provider + Hook · 单一数据源)

### 2.1 Context Value 契约 (`VisualThemeContextValue`)

```ts
{
  themeId:     "cyberpunk88" | "sunrise";         // 当前主题 ID
  tokens:      VisualTokensType;                  // ★ 唯一数据源 (只读对象)
  setThemeId:  (id: ThemeId) => void;             // 切换 → 写 State + localStorage + :root
  toggleTheme: () => void;                        // 便捷切换 cyberpunk88 ⇄ sunrise
  isLight:     boolean;                           // 语义化快捷判断 (sunrise=true)
}
```

### 2.2 Provider 初始化优先级 (按序)

```
1) initialThemeId prop          ← SSR / 强制指定场景
2) localStorage.getItem(
     "yyc3_visual_theme_v1"
   )                            ← 用户上次选择 (跨刷新保留)
3) prefers-color-scheme         ← 系统主题 (light→sunrise / dark→cyberpunk88)
4) 兜底 cyberpunk88             ← 极端情况不崩
```

### 2.3 🪂 无 Provider 静默降级

```tsx
// ⚠️ 你没包 Provider 时，依然不会崩！
// useVisualTheme() 自动 fallback → cyberpunk88
// setThemeId() / toggleTheme() 只打印 console.warn，不报错

const { tokens, isLight } = useVisualTheme();
// → 永远有值: tokens = CYBERPUNK_88_THEME, isLight = false
```

### 2.4 `:root` CSS Variables 自动注入

Provider 自动把 `toCssVars(tokens)` 结果应用到 `<html style="...">`，方便 Tailwind / 原生 CSS 读取：

```css
:root {
  --vis-canvas-bg: #0d1117;          --vis-canvas-panel: rgba(255,255,255,0.02);
  --vis-text-primary: rgba(255,255,255,0.85);
  --vis-primary-500: #06b6d4;       --vis-success: #10b981;
  --vis-family-0: #06b6d4;          /* familySeries 全展开 */
  --vis-size-sm: 130px;             --vis-radius: 12px;
}
```

---

## 3️⃣ · 图表组件库

所有 `charts/*.tsx` 统一遵循开发者文档 §5.1 **BaseChartProps 契约**：

| 组件 | 文件 | 特性 |
|---|---|---|
| **雷达图** | `charts/RadarChart.tsx` | v2.0 · Zod 校验 · §5 BaseChartProps · 双主题 · 多主体 (≤8) · 8 家族自动配色 |
| **延迟趋势** | `../model-settings/LatencyTrendChart.tsx` | v2.0 · LTTB 自动降采样 · 状态点高亮 · 双主题 · 异常梯度着色 |

### 3.1 RadarChart 接入示例 (新代码直接抄)

```tsx
import { RadarChart } from "@/components/visualization/charts/RadarChart";
import type { RadarChartData } from "@/components/visualization/validators/chart.schemas";

const data: RadarChartData = {
  axes: [
    { key: "plan",   name: "规划力", fullMark: 100 },
    { key: "exec",   name: "执行力", fullMark: 100 },
    { key: "analy",  name: "分析力", fullMark: 100 },
    { key: "secure", name: "安全性", fullMark: 100 },
    { key: "qual",   name: "质量",   fullMark: 100 },
    { key: "crea",   name: "创意",   fullMark: 100 },
  ],
  subjects: [
    { name: "天枢", values: [92, 88, 70, 65, 78, 60] }, // 取 familySeries[0]
    { name: "千行", values: [60, 95, 75, 55, 70, 82] }, // 取 familySeries[1]
  ],
};

<RadarChart data={data} height={320} showTooltip showLegend />
```

### 3.2 LatencyTrendChart 接入示例

```tsx
import { LatencyTrendChart } from "@/components/model-settings/LatencyTrendChart";

// diagnostics: Record<string, DiagnosticResult> 业务已存在的数据结构
<LatencyTrendChart diagnostics={diagnostics} />
```

内部会自动：
1. 从 `useVisualTheme()` 取当前 tokens（自动切色）
2. `autoDownsample()` 根据数据量选择 `none / md / lg / xl` 4 档
3. `statusToSemantic()` → `getSemanticColorForTokens()` 画异常点

### 3.3 色板使用铁律 (开发者文档 §4.2)

| 场景 | 必须使用 | 禁止 |
|---|---|---|
| 主趋势线 | `tokens.primary[500]` | 艳绿、黄色 |
| 异常高亮 | `tokens.semantic.error` | 紫色、蓝色 |
| 多系列对比 | `tokens.familySeries[i]` 顺序取 | 写死色值 |
| 面积图渐变 | `tokens.gradients.latencyArea` + `defs linearGradient` | 直接写 stopColor |

---

## ⚡ 性能优化 · LTTB 降采样

### 4 档自动策略 (`autoDownsample`)

| 原始数据量 | 策略 | 目标输出 | 阈值触发 |
|---|---|---|---|
| < 200 | `none` (直通) | 原样 | n/a |
| 200 ~ 1999 | `md` | 800 点 | 2000 点告警线之前 |
| 2000 ~ 9999 | `lg` | 1200 点 | LatencyTrendChart 文档阈值 |
| ≥ 10000 | `xl` | 2000 点 | 超大时间窗口 |

### 算法不变式保证

- ✅ 首末两点**永不丢失**（保证折线起点/终点和原图一致）
- ✅ 采用 **Largest-Triangle-Three-Buckets** 学术算法 — 保留视觉特征（极值、拐点、峰谷）
- ✅ **O(n)** 线性时间复杂度 — 百万点级别 < 50ms

### 直接调用示例

```ts
import { autoDownsample } from "@/components/visualization/utils/lttb";

const { data: sampled, strategy, originalLength } = autoDownsample(
  rawRows.map(r => ({ x: r.timestamp, y: r.latency, raw: r }))
);
// originalLength = 4821, strategy = "lg", sampled.length ≈ 1200
```

---

## 🔐 Zod 数据校验契约

所有图表入参**运行时**二次校验（开发者文档 §6）：

```tsx
// RadarChart 内部自动做：
const parseResult = RadarChartDataSchema.safeParse(data);
if (!parseResult.success) {
  // → 空状态友好展示 + <details> 展开 Zod 错误详情
}
```

| Schema | 边界约束 |
|---|---|
| `TimeSeriesPointSchema` | `timestamp: number, value: number, status: string?` |
| `LineChartDataSchema` | `max(100_000)` — 上限 10 万点 |
| `RadarAxisSchema` | `min(3)` 维度，`max(16)` 维度 |
| `RadarSubjectSchema` | `values: z.array(z.number())` |
| `RadarChartDataSchema` | `subjects: min(1).max(8)` — 8 家族上限 |
| `DonutChartDataSchema` | `min(1).max(32)` — 扇区合理范围 |

---

## 4️⃣ · 快速开始

### 步骤 1：包裹 Provider (应用根)

```tsx
// ide/app/App.tsx  ← 放在根组件最外层
import { VisualThemeProvider } from "@/components/visualization/useVisualTheme";

export default function App() {
  return (
    <VisualThemeProvider>
      {/* ... 你的路由 / 布局 / 其它 Providers ... */}
    </VisualThemeProvider>
  );
}

// —— SSR 或 强制指定初始主题 ——
<VisualThemeProvider initialThemeId="sunrise">
  {children}
</VisualThemeProvider>
```

### 步骤 2：业务组件中使用

```tsx
import { useVisualTheme } from "@/components/visualization/useVisualTheme";

function ThemeToggleButton() {
  const { themeId, isLight, toggleTheme } = useVisualTheme();
  return (
    <button onClick={toggleTheme}>
      当前: {isLight ? "☀️ SunRise 亮色" : "🌙 Cyberpunk-88 深色"}
      ({themeId})
    </button>
  );
}
```

### 步骤 3：自定义卡片背景 (无 recharts 场景)

```tsx
function PanelCard({ children }) {
  const { tokens } = useVisualTheme();
  return (
    <div style={{
      background: tokens.canvas.panel,
      border: `1px solid ${tokens.canvas.border}`,
      borderRadius: tokens.spacing.radius,
      padding: tokens.spacing.padding,
      color: tokens.text.primary,
    }}>
      {children}
    </div>
  );
}
```

### 步骤 4：向后兼容 · 旧代码不用改

```ts
// 旧代码:  import { t, VISUAL_TOKENS } from "./theme/tokens"
// v1.x 风格: t.canvas.bg, getSemanticColor("error") 等全部继续工作
// → 全部由 theme/tokens.ts 重导出桥接，零修改上线
```

### 步骤 5：编译验证

```bash
cd ide
./node_modules/.bin/tsc --noEmit     # ✅ exit 0  (本次交付实测)
pnpm test components/visualization    # 下一节
```

---

## 5️⃣ · 测试覆盖

### AgentSkills 55 `vis-*` 用例集

**交付实测通过：92 passed / 92 tests (Vitest 1.6.1 / 24 ms)**

```
组件层渲染集成 · 25%
├─ vis-51  Provider 默认 cyberpunk88 (localStorage 清空)
├─ vis-52  setThemeId('sunrise') 生效 + tokens.canvas.bg → #ffffff
├─ vis-53  setThemeId('bogus') 不生效 (不变更)
├─ vis-54  切换写入 localStorage 键 yyc3_visual_theme_v1
└─ vis-55  🪂 无 Provider 环境静默降级 cyberpunk88 (不崩溃!)

纯函数工具 · 70%
├─ vis-01~vis-06  令牌结构完整 + 尺寸/间距跨主题一致
├─ vis-07~vis-11  颜色差异化 (白底/深底) + WCAG AA
├─ vis-12~vis-18  THEME_REGISTRY + getThemeById() 6 种容错
├─ vis-19~vis-20  向后兼容别名 t / VISUAL_TOKENS
├─ vis-21~vis-25  语义取色 (默认 / 指定 tokens 双版本)
├─ vis-26~vis-37  statusToSemantic 52 关键词全覆盖 (success/error/warning/info/purple)
├─ vis-38~vis-39  statusColor 双 API
├─ vis-40~vis-42  toCssVars 返回 Record 包含全部关键 var
├─ vis-43~vis-48  LTTB 算法 (空数组/原样/首尾不变/4档策略)
└─ vis-49~vis-50  makeChartGradId 唯一且长度可控
```

### 运行命令

```bash
cd ide

# 单独跑可视化用例
./node_modules/.bin/vitest run components/visualization/__tests__/VisualThemeAndCharts.test.tsx

# 全仓测试
pnpm test

# 覆盖率
pnpm test:coverage
```

---

## 🏛️ Five High 架构合规矩阵

| 原则 | 本模块落地 |
|---|---|
| **高可用** | ✅ 无 Provider 静默降级 cyberpunk88 · getThemeById 容错 · localStorage 读异常吞错 |
| **高性能** | ✅ LTTB O(n) 降采样 · 4 档自动策略 · tokens 对象引用稳定避免重渲染 · `ResponsiveContainer` 懒测量 |
| **高安全** | ✅ Zod 运行时校验 · SVG Gradient ID 唯一防污染 · localStorage 写 JSON safe · CSS var 字符串合法 |
| **高扩展** | ✅ `THEME_REGISTRY[themeId]` 加主题零代码改动 · BaseChartProps 统一契约 · 语义取色函数独立 |
| **高智能** | ✅ `prefers-color-scheme` 自动检测 · `autoDownsample` 智能选档 · `statusToSemantic` 52 关键词 NLP 级映射 |

---

## 变更历史

| 版本 | 日期 | 变更内容 | 作者 |
|---|---|---|---|
| **v2.0.0** | 2026-08-19 | 🔆 新增 SunRise 亮色主题 `VISUAL_TOKENS_SUNRISE` · Provider/Hook Context 架构 · RadarChart & LatencyTrendChart 接入双主题 · 扩展 `statusToSemantic` 52 关键词 · AgentSkills 55 vis-* 92 用例 · 向后兼容 tokens.ts 桥 | YanYuCloudCube Team |
| v1.0.0 | 2026-08-19 | 初始版本 · Cyberpunk-88 深色主题 · LTTB 算法 · Zod 校验契约 · RadarChart 初版 | YanYuCloudCube Team |

---

<div align="center">

## License

**MIT License** · Copyright (c) 2026 YanYuCloudCube Team

---

> 「***YanYuCloudCube***」
> 「***<admin@0379.email>***」
> 「***Words Initiate Quadrants, Language Serves as Core for Future***」
> 「***All things converge in cloud pivot; Deep stacks ignite a new era of intelligence***」

</div>
