/**
 * file: storage-keys.ts
 * description: localStorage 存储键名 & JSON 序列化工具
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v1.0.0
 * created: 2026-07-25
 * updated: 2026-08-19
 * status: active
 * tags: [config],[storage],[localStorage],[constants]
 *
 * brief: 统一管理 localStorage key 常量 & JSON 读写工具函数
 *
 * details:
 * - SK_* 前缀常量集中定义，避免硬编码散落在业务文件
 * - loadJSON / saveJSON 通用封装带 try/catch，解析失败静默回退默认值
 *
 * dependencies: none (浏览器 API)
 * exports:
 *   SK_MODEL_PERF_DATA, SK_SAVED_PRESETS,
 *   loadJSON, saveJSON
 */

// ==================================================================
// 1. localStorage Key 常量 (前缀 SK = Storage Key)
// ==================================================================

/** 模型性能历史数据 — LatencyTrendChart 消费 (格式: Array<{modelName,latencyMs,success,timestamp}>) */
export const SK_MODEL_PERF_DATA = "yyc3_model_perf_history_v1";

/** 布局预设保存数据 — LayoutPresetsEnhanced 消费 */
export const SK_SAVED_PRESETS = "yyc3_layout_presets_v2";

/** 用户自定义服务商定义 — ModelRegistry 消费（Agent 批③回迁时从单体补回） */
export const SK_CUSTOM_PROVIDERS = "yyc3-custom-providers";

/** 代理配置 — ProxyService 消费（审计 Batch C 补回） */
export const SK_PROXY_CONFIG = "yyc3_proxy_config";

/** 存储键前缀族 — BackupService 扫描 localStorage 用（第二批回迁时从单体补回） */
export const STORAGE_PREFIXES = ["yyc3_", "yyc3-"] as const;

// ==================================================================
// 2. 通用 JSON 读写工具
// ==================================================================

/**
 * 从 localStorage 读取 JSON
 * @param key localStorage 键名
 * @param defaultValue 读取失败 / 空时的默认返回值
 */
export function loadJSON<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined" || !window.localStorage) {
    return defaultValue;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null || raw === "") return defaultValue;
    return JSON.parse(raw) as T;
  } catch (_err) {
    return defaultValue;
  }
}

/**
 * 写入 JSON 到 localStorage
 * @param key localStorage 键名
 * @param value 可序列化的值
 */
export function saveJSON(key: string, value: unknown): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_err) {
    /* 忽略 quotaExceeded / 隐私模式等异常 */
  }
}
