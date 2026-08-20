/**
 * @file: index.ts
 * @description: LLM 上下文工程层统一出口 — 压缩 / 摘要 / 上下文收集
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [llm],[context],[compression],[index],[barrel],[re-export]
 *
 * brief: 上下文工程能力域的「单一入口」——2026 IDE 趋势中 Context Engine 的基石
 *
 * usage:
 * ```
 * import {
 *   ContextCompressor,
 *   DEFAULT_COMPRESSION_CONFIG,
 *   collectContext,
 *   compressContext,
 * } from "@/llm";
 *
 * const compressor = new ContextCompressor();
 * const result = compressor.compress(largeFileContent, "typescript");
 * ```
 *
 * dependencies: 无外部依赖（模块内自包含）
 * exports: 压缩引擎 / 策略设计器 / 摘要生成器 / 上下文收集器
 */

// —— 核心压缩引擎 ——
export { ContextCompressor } from "./ContextCompressor";

// —— 策略设计器与摘要生成器（可独立使用）——
export { CompressionStrategyDesigner } from "./CompressionStrategy";
export { ContentSummarizer } from "./ContentSummarizer";

// —— 上下文收集（FileStore → LLM 上下文投影）——
export { collectContext, estimateTokens, compressContext } from "./ContextCollector";
export type { ProjectContext, ContextCollectorInput } from "./ContextCollector";

// —— 类型与默认配置 ——
export {
  CodeSegmentType,
  SegmentImportance,
  CompressionStrategyType,
  DEFAULT_COMPRESSION_CONFIG,
} from "./ContextCompressionTypes";

export type {
  CodeSegment,
  CompressionStrategy,
  SummaryResult,
  CompressionResult,
  CompressionQuality,
  CompressionConfig,
  CompressionStats,
} from "./ContextCompressionTypes";
