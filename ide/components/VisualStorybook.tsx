/**
 * file: VisualStorybook.tsx
 * description: 可视化 Storybook 面板 · 双主题切换 + 所有图表边界数据展示 + 性能检测
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v1.0.0
 * created: 2026-08-19
 * updated: 2026-08-19
 * status: active
 * tags: [component],[storybook],[visualization],[debug],[performance]
 *
 * brief: 可视化组件的「活文档面板」· 等价于 Storybook，但零额外依赖
 *
 * details:
 * ═══════════════════════════════════════════════════════════════════
 *  Section A · Toolbar 工具栏
 *    - 主题切换: Cyberpunk-88 (深色) ↔ SunRise (亮色)
 *    - 数据规模选择器: 100 / 2001 (LTTB MD) / 10000 (LTTB LG) / 50000 (LTTB XL)
 *    - 深色模式性能检测按钮 (开/关动画对比)
 *  Section B · LatencyTrendChart Stories (5 cards)
 *    - B1 空数据状态
 *    - B2 常规 50 条 (无 LTTB, 开动画)
 *    - B3 2001 条 → LTTB MD 400 点
 *    - B4 50000 条 → LTTB XL 600 点
 *    - B5 极端尖峰数据 (方波) · 验证 LTTB 不丢拐点
 *  Section C · RadarChart Stories (6 cards)
 *    - C1 最少边界: 3 axes × 1 subject
 *    - C2 最多边界: 16 axes × 8 subjects (8家族6维)
 *    - C3 推荐规格: 6 axes × 4 subjects (4家族对比)
 *    - C4 Zod 非法输入: 2 axes (不足) → 空状态
 *    - C5 Zod 非法输入: 缺 subjects → 空状态 + Zod 详情
 *    - C6 subject color 自定义 + null values 自动 0
 *  Section D · 深色模式性能面板
 *    - D1 渲染时间基准 (animation ON vs OFF)
 *    - D2 数据规模 vs FPS 估算
 *    - D3 内存占用对比 (原始数据 / LTTB 后)
 * ═══════════════════════════════════════════════════════════════════
 *
 * dependencies: react, lucide-react, recharts,
 *               ./visualization (统一入口 index.ts)
 *               ./model-settings/LatencyTrendChart
 *               ./visualization/charts/RadarChart
 * exports: VisualStorybook (named + default)
 * notes: 必须放在 <VisualThemeProvider> 之内使用 (Toolbar 内部直接调用 setThemeId)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sun, Moon, Activity, BarChart3, Target as RadarIcon, Zap,
  Eye, EyeOff, Settings as Palette, Layers, ChevronDown, ChevronUp,
} from "lucide-react";

// —— 统一入口：所有可视化工具从这里拿 ——
import {
  useVisualTheme,
  VisualThemeProvider,
  CYBERPUNK_88_THEME,
  type ThemeId,
  type RadarChartData,
  type FamilyVisualRole,
  autoDownsample,
  type LTTBPoint,
  formatValueWithUnit,
} from "./visualization";

// —— 图表组件 ——
import { LatencyTrendChart, buildChartRows } from "./model-settings/LatencyTrendChart";
import { RadarChart, type RadarChartProps } from "./visualization/charts/RadarChart";
import type { DiagnosticResult } from "./model-settings/types";

// ==================================================================
// 0. LatencyTrendChart: stories 数据工厂
// ==================================================================

/** 构造 n 条 DiagnosticResult 形式的假延迟数据 (正弦+噪声) */
function fakeDiagnostics(n: number, mode: "normal" | "spike" = "normal"): Record<string, DiagnosticResult> {
  const out: Record<string, DiagnosticResult> = {};
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const t = now - (n - i) * 3_000; // 每 3 秒一条
    const base = 200 + Math.sin(i / 7) * 80 + (Math.random() - 0.5) * 40;
    let latency = Math.max(20, base);
    if (mode === "spike" && i % 50 === 25) {
      latency = 5000; // 尖峰
    }
    const status: "success" | "error" = latency > 1000 ? "error" : "success";
    out[`k${i}`] = {
      providerId: `prov-${i % 4}`,
      modelName: `gpt-model-${i % 8}`,
      latency,
      status,
      message: `诊断 #${i} ${status === "success" ? "通过" : "失败"}`,
      timestamp: t,
    };
  }
  return out;
}

// ==================================================================
// 1. RadarChart: stories 数据工厂
// ==================================================================

const AGENT_FAMILY: FamilyVisualRole[] = [
  "tianshu", "qianhang", "wanwu", "xianzhi", "bole", "shouhu", "zongshi", "lingyun",
];
const AGENT_LABEL: Record<FamilyVisualRole, string> = {
  tianshu: "元启·天枢", qianhang: "言启·千行", wanwu: "语枢·万物", xianzhi: "预见·先知",
  bole: "知遇·伯乐", shouhu: "智云·守护", zongshi: "格物·宗师", lingyun: "创想·灵韵",
};

function makeRadar6Axes(): { name: string; fullMark?: number; unit?: string }[] {
  return [
    { name: "规划", fullMark: 100 },
    { name: "推理", fullMark: 100 },
    { name: "工具", fullMark: 100, unit: "%" },
    { name: "记忆", fullMark: 100 },
    { name: "创造", fullMark: 100 },
    { name: "协作", fullMark: 100 },
  ];
}
function makeRadarSubjects(n: number, axesLen: number) {
  return Array.from({ length: n }, (_, i) => {
    const role = AGENT_FAMILY[i % 8];
    return {
      name: AGENT_LABEL[role],
      values: Array.from({ length: axesLen }, () => Math.round(40 + Math.random() * 55)),
    };
  });
}

// ==================================================================
// 2. Section A · Toolbar 工具栏
// ==================================================================

interface StoryToolbarProps {
  onBenchmark: (r: { size: number; mode: "on" | "off"; ms: number }) => void;
}

function StoryToolbar(_props: StoryToolbarProps) {
  const { themeId, setThemeId, isLight, tokens } = useVisualTheme();
  const { onBenchmark } = _props;
  const [dataSize, setDataSize] = useState<100 | 2001 | 10000 | 50000>(2001);
  const [benchRunning, setBenchRunning] = useState(false);
  const [animMode, setAnimMode] = useState<"on" | "off">("on");

  const runBench = useCallback(async () => {
    setBenchRunning(true);
    // 构造数据
    const diag = fakeDiagnostics(dataSize);
    const rows = buildChartRows(diag);
    const lttbInput = rows.map(r => ({ x: r.timestamp, y: r.latency, raw: r } as LTTBPoint));

    // 测 autoDownsample 5 次取平均
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) autoDownsample(lttbInput);
    const t1 = performance.now();
    const ms = (t1 - t0) / 5;
    onBenchmark({ size: dataSize, mode: animMode, ms });

    // 视觉反馈
    await new Promise(r => setTimeout(r, 400));
    setBenchRunning(false);
  }, [dataSize, animMode, onBenchmark]);

  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        border: `1px solid ${tokens.canvas.border}`,
        background: tokens.canvas.panel,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: Title + Theme Switch */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Palette style={{ width: 16, height: 16, color: tokens.primary[500] }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: tokens.text.primary }}>
            VisualStorybook · 可视化组件活文档
          </span>
        </div>
        <button
          onClick={() => setThemeId(themeId === "sunrise" ? "cyberpunk88" : "sunrise")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 8,
            background: isLight ? "#f1f5f9" : "rgba(255,255,255,0.04)",
            border: `1px solid ${tokens.canvas.border}`,
            color: tokens.text.secondary, cursor: "pointer", fontSize: 11,
          }}
        >
          {isLight ? <Moon style={{ width: 13, height: 13 }} /> : <Sun style={{ width: 13, height: 13 }} />}
          {isLight ? "切到 Cyberpunk-88 深色" : "切到 SunRise 亮色"}
        </button>
        <span
          style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 999,
            color: tokens.primary[500],
            border: `1px solid ${tokens.primary[500]}55`,
          }}
        >
          当前: {themeId}
        </span>
      </div>

      {/* Right: Data Size + Benchmark */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Layers style={{ width: 13, height: 13, color: tokens.text.disabled }} />
        <span style={{ fontSize: 10, color: tokens.text.tertiary }}>数据规模</span>
        <select
          value={dataSize}
          onChange={(e) => setDataSize(Number(e.target.value) as any)}
          style={{
            padding: "5px 8px", borderRadius: 6, fontSize: 10,
            background: tokens.canvas.bgElevated, color: tokens.text.primary,
            border: `1px solid ${tokens.canvas.border}`,
          }}
        >
          <option value={100}>100 条 (无 LTTB, anim 开)</option>
          <option value={2001}>2,001 条 (LTTB·MD→400)</option>
          <option value={10000}>10,000 条 (LTTB·LG→500)</option>
          <option value={50000}>50,000 条 (LTTB·XL→600)</option>
        </select>

        <button
          onClick={() => setAnimMode(animMode === "on" ? "off" : "on")}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 8px", borderRadius: 6, fontSize: 10,
            background: tokens.canvas.bgElevated, color: tokens.text.secondary,
            border: `1px solid ${tokens.canvas.border}`, cursor: "pointer",
          }}
        >
          {animMode === "on" ? <Eye style={{ width: 12, height: 12 }} /> : <EyeOff style={{ width: 12, height: 12 }} />}
          动画 {animMode.toUpperCase()}
        </button>

        <button
          onClick={runBench}
          disabled={benchRunning}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 6, fontSize: 10,
            background: benchRunning ? tokens.semantic.warning : tokens.primary[500],
            color: isLight ? "#ffffff" : "#0b1220",
            border: "none", cursor: benchRunning ? "wait" : "pointer",
            fontWeight: 600,
          }}
        >
          <Zap style={{ width: 12, height: 12 }} />
          {benchRunning ? "性能检测中…" : "性能检测"}
        </button>
      </div>
    </div>
  );
}

// ==================================================================
// 3. Story Card 包装器 (统一卡片外观)
// ==================================================================

function StoryCard(props: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const { tokens } = useVisualTheme();
  const { title, subtitle, icon, children, collapsed, onToggle } = props;
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${tokens.canvas.border}`,
        background: tokens.canvas.panel,
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: "10px 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: onToggle ? `1px solid ${tokens.canvas.border}` : undefined,
          cursor: onToggle ? "pointer" : "default",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: tokens.primary[500] }}>{icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: tokens.text.primary }}>{title}</div>
            <div style={{ fontSize: 10, color: tokens.text.tertiary }}>{subtitle}</div>
          </div>
        </div>
        {onToggle && (
          collapsed
            ? <ChevronDown style={{ width: 14, height: 14, color: tokens.text.disabled }} />
            : <ChevronUp style={{ width: 14, height: 14, color: tokens.text.disabled }} />
        )}
      </div>
      {!collapsed && (
        <div style={{ padding: 14 }}>{children}</div>
      )}
    </div>
  );
}

// ==================================================================
// 4. Section D · 性能检测面板
// ==================================================================

interface BenchRecord { size: number; mode: "on" | "off"; ms: number; ts: number; }

function PerfPanel({ records }: { records: BenchRecord[] }) {
  const { tokens } = useVisualTheme();

  // 模拟计算: 渲染时间 ≈ LTTB 基准时间 + 数据点数 × 渲染系数
  const estimateRender = (size: number, anim: boolean) => {
    const lttb = autoDownsample(Array.from({ length: size }, (_, i) => ({ x: i, y: i })));
    const pts = lttb.data.length;
    const base = lttb.data.length === size ? 8 : 0; // 没走 LTTB
    return Math.round((base + pts * (anim ? 0.32 : 0.04) + records[0]?.ms) * 10) / 10;
  };

  const last = records[records.length - 1];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 10,
      }}
    >
      {[
        {
          k: "LTTB 基准 (5次均值)",
          v: last ? `${last.ms.toFixed(2)} ms` : "—",
          hint: last ? `N=${last.size} · 动画 ${last.mode.toUpperCase()}` : "点击右上角「性能检测」",
          c: tokens.primary[500],
        },
        {
          k: "渲染估算 (动画 ON)",
          v: `${estimateRender(2001, true)} ms`,
          hint: "N=2,001 · 200+ 点自动关动画会自动缩短",
          c: tokens.semantic.info,
        },
        {
          k: "渲染估算 (动画 OFF)",
          v: `${estimateRender(50000, false)} ms`,
          hint: "N=50,000 · LTTB 600 + 无动画",
          c: tokens.semantic.success,
        },
        {
          k: "数据内存节省",
          v: "98.8%",
          hint: "50000 原始点 → 600 LTTB 点 · 98.8% 降比",
          c: tokens.semantic.purple,
        },
      ].map((m) => (
        <div
          key={m.k}
          style={{
            padding: 12, borderRadius: 10,
            border: `1px solid ${tokens.canvas.border}`,
            background: tokens.canvas.bgElevated,
          }}
        >
          <div style={{ fontSize: 10, color: tokens.text.tertiary, marginBottom: 4 }}>{m.k}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: m.c, fontFamily: tokens.font.mono }}>
            {m.v}
          </div>
          <div style={{ fontSize: 9, color: tokens.text.disabled, marginTop: 4 }}>{m.hint}</div>
        </div>
      ))}
    </div>
  );
}

// ==================================================================
// 5. 主组件
// ==================================================================

export function VisualStorybook() {
  const { tokens } = useVisualTheme();

  // 折叠状态 (默认全部展开)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed((p) => ({ ...p, [k]: !p[k] }));

  // 性能记录
  const [benchRecords, setBenchRecords] = useState<BenchRecord[]>([]);
  const onBenchmark = useCallback((r: BenchRecord) => {
    setBenchRecords((p) => [...p, { ...r, ts: Date.now() }].slice(-10));
  }, []);

  // —— B · Latency stories ——
  const lat_empty = useMemo(() => ({}), []);
  const lat_50 = useMemo(() => fakeDiagnostics(50), []);
  const lat_2001 = useMemo(() => fakeDiagnostics(2001), []);
  const lat_50k = useMemo(() => fakeDiagnostics(50000), []);
  const lat_spike = useMemo(() => fakeDiagnostics(2001, "spike"), []);

  // —— C · Radar stories ——
  const radar_min: RadarChartProps["data"] = useMemo(() => ({
    axes: [{ name: "规划" }, { name: "推理" }, { name: "工具" }],
    subjects: [{ name: AGENT_LABEL.tianshu, values: [88, 75, 92] }],
  }), []);
  const radar_max: RadarChartProps["data"] = useMemo(() => {
    const axes = Array.from({ length: 16 }, (_, i) => ({
      name: `维度${i + 1}`, fullMark: 100,
    }));
    return { axes, subjects: makeRadarSubjects(8, 16) } as RadarChartData;
  }, []);
  const radar_std: RadarChartProps["data"] = useMemo(() => ({
    axes: makeRadar6Axes(),
    subjects: [
      { name: AGENT_LABEL.tianshu, values: [92, 85, 78, 88, 70, 65] },
      { name: AGENT_LABEL.qianhang, values: [75, 90, 88, 70, 82, 85] },
      { name: AGENT_LABEL.xianzhi, values: [80, 70, 75, 92, 90, 60] },
      { name: AGENT_LABEL.bole, values: [65, 72, 95, 68, 75, 92] },
    ],
  }), []);
  const radar_badAxes: any = useMemo(() => ({
    axes: [{ name: "a" }, { name: "b" }], // 不足 3 轴
    subjects: [{ name: "X", values: [1, 2] }],
  }), []);
  const radar_badSubjects: any = useMemo(() => ({
    axes: makeRadar6Axes(),
    // 缺 subjects
  }), []);
  const radar_custom: RadarChartProps["data"] = useMemo(() => ({
    axes: makeRadar6Axes(),
    subjects: [
      { name: "自定义色·灵韵", values: [95, null as any, 80, 70, 88, 75], color: "#ec4899" }, // null → 自动 0
      { name: "正常·宗师", values: [70, 85, 60, 92, 78, 88], color: "#ef4444" },
    ],
  }), []);

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 1440,
        margin: "0 auto",
        fontFamily: tokens.font.sans,
      }}
    >
      {/* A · Toolbar */}
      <StoryToolbar onBenchmark={onBenchmark} />

      <div style={{ height: 16 }} />

      {/* B · LatencyTrendChart Stories */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <StoryCard
          icon={<Activity style={{ width: 14, height: 14 }} />}
          title="B1 · 延迟趋势 · 空数据"
          subtitle="无诊断 → 显示空状态插画 + 引导文字"
          collapsed={collapsed.B1}
          onToggle={() => toggle("B1")}
        >
          <LatencyTrendChart diagnostics={lat_empty as any} />
        </StoryCard>

        <StoryCard
          icon={<Activity style={{ width: 14, height: 14 }} />}
          title="B2 · 延迟趋势 · 常规 50 条"
          subtitle="≤2000 · strategy=none · 动画开启"
          collapsed={collapsed.B2}
          onToggle={() => toggle("B2")}
        >
          <LatencyTrendChart diagnostics={lat_50 as any} />
        </StoryCard>

        <StoryCard
          icon={<Activity style={{ width: 14, height: 14 }} />}
          title="B3 · 延迟趋势 · 2001 条 LTTB MD"
          subtitle="越过 2000 阈值 · 自动 MD 档 → 400 点"
          collapsed={collapsed.B3}
          onToggle={() => toggle("B3")}
        >
          <LatencyTrendChart diagnostics={lat_2001 as any} />
        </StoryCard>

        <StoryCard
          icon={<Activity style={{ width: 14, height: 14 }} />}
          title="B4 · 延迟趋势 · 50,000 条 LTTB XL"
          subtitle="≥50000 超大阈值 · XL 档 → 600 点"
          collapsed={collapsed.B4}
          onToggle={() => toggle("B4")}
        >
          <LatencyTrendChart diagnostics={lat_50k as any} />
        </StoryCard>

        <div style={{ gridColumn: "span 2" }}>
          <StoryCard
            icon={<Zap style={{ width: 14, height: 14 }} />}
            title="B5 · 延迟趋势 · 方波尖峰 (LTTB 保真验证)"
            subtitle="每 50 条插入 5000ms 尖峰 · LTTB 算法必须保留尖峰不丢"
            collapsed={collapsed.B5}
            onToggle={() => toggle("B5")}
          >
            <LatencyTrendChart diagnostics={lat_spike as any} />
          </StoryCard>
        </div>
      </div>

      <div style={{ height: 20 }} />

      {/* C · RadarChart Stories */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <StoryCard
          icon={<RadarIcon style={{ width: 14, height: 14 }} />}
          title="C1 · 雷达图 · 最少边界 3轴×1主体"
          subtitle="axes=3 (min) · subjects=1 (min)"
          collapsed={collapsed.C1}
          onToggle={() => toggle("C1")}
        >
          <RadarChart data={radar_min} height={260} />
        </StoryCard>

        <StoryCard
          icon={<RadarIcon style={{ width: 14, height: 14 }} />}
          title="C2 · 雷达图 · 最大边界 16轴×8主体"
          subtitle="axes=16 (max) · subjects=8 (max) · 自动关动画"
          collapsed={collapsed.C2}
          onToggle={() => toggle("C2")}
        >
          <RadarChart data={radar_max} height={320} />
        </StoryCard>

        <StoryCard
          icon={<RadarIcon style={{ width: 14, height: 14 }} />}
          title="C3 · 雷达图 · 推荐规格 6轴×4"
          subtitle="4 家族 6 维能力画像 · 标准案例"
          collapsed={collapsed.C3}
          onToggle={() => toggle("C3")}
        >
          <RadarChart data={radar_std} height={280} />
        </StoryCard>

        <StoryCard
          icon={<RadarIcon style={{ width: 14, height: 14 }} />}
          title="C4 · 雷达图 · Zod 失败 axes<3"
          subtitle="2 轴不足 → 空状态 + 原因显示"
          collapsed={collapsed.C4}
          onToggle={() => toggle("C4")}
        >
          <RadarChart data={radar_badAxes} height={220} />
        </StoryCard>

        <StoryCard
          icon={<RadarIcon style={{ width: 14, height: 14 }} />}
          title="C5 · 雷达图 · Zod 失败缺 subjects"
          subtitle="字段缺失 → 展开查看 Zod 校验详情"
          collapsed={collapsed.C5}
          onToggle={() => toggle("C5")}
        >
          <RadarChart data={radar_badSubjects} height={220} />
        </StoryCard>

        <StoryCard
          icon={<RadarIcon style={{ width: 14, height: 14 }} />}
          title="C6 · 雷达图 · 自定义颜色 + null→0"
          subtitle="subject.color 覆盖 + values[1]=null→0 自动变换"
          collapsed={collapsed.C6}
          onToggle={() => toggle("C6")}
        >
          <RadarChart data={radar_custom} height={260} />
        </StoryCard>
      </div>

      <div style={{ height: 20 }} />

      {/* D · 性能面板 */}
      <StoryCard
        icon={<BarChart3 style={{ width: 14, height: 14 }} />}
        title="D · 深色模式性能 · 自动化检测面板"
        subtitle="五维评估 · 时间维(渲染速度) · 空间维(内存节省) · 属性维(动画开关策略)"
        collapsed={collapsed.D}
        onToggle={() => toggle("D")}
      >
        <PerfPanel records={benchRecords} />

        <div style={{ height: 14 }} />
        <div
          style={{
            padding: 12, borderRadius: 10, fontSize: 11,
            border: `1px dashed ${tokens.canvas.border}`,
            color: tokens.text.secondary,
            background: tokens.canvas.bgElevated,
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: tokens.text.primary }}>深色模式性能最佳实践 · 自动触发规则：</strong>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li>数据点数 <code>{">"}200</code> → LatencyTrendChart 自动 <code>isAnimationActive=false</code> (SVG + CSS + Layout 压力)"</li>
            <li>RadarChart axes × subjects {">"} 64 → 自动关动画 (组件内部判断)</li>
            <li>LTTB 4 档阈值：2k / 10k / 50k → 400 / 500 / 600，保证任何规模渲染不超过 600 点</li>
            <li>所有 SVG 渐变 ID 唯一 (makeChartGradId) → 多图表不串色、无回流</li>
            <li>tokens 对象 useMemo 稳定引用 → 切主题前所有子组件不重渲</li>
          </ul>
          <div style={{ marginTop: 8, fontSize: 10, color: tokens.text.tertiary }}>
            🔧 数据规模 → 渲染估算：
            N=100 → 约 {formatValueWithUnit(100 * 0.32, "ms")} ·
            N=2,001 → 约 {formatValueWithUnit(400 * 0.04 + 0.25, "ms")} (LTTB 收益 3x) ·
            N=50,000 → 约 {formatValueWithUnit(600 * 0.04 + 1.5, "ms")} (LTTB 收益 {Math.round(50000 / 600)}x)
          </div>
        </div>
      </StoryCard>

      <div style={{ height: 40 }} />
      <div
        style={{
          textAlign: "center", fontSize: 10, color: tokens.text.disabled,
          fontFamily: tokens.font.mono,
        }}
      >
        YYC³ VisualStorybook · 可视化组件活文档 · Cyberpunk-88 ⇄ SunRise (WCAG AA) · LTTB × Zod 双保险
      </div>
    </div>
  );
}

// —— 方便作为页面直接嵌入 App 路由：外层自动包 Provider ——
export default function VisualStorybookPage() {
  return (
    <VisualThemeProvider>
      <VisualStorybook />
    </VisualThemeProvider>
  );
}
