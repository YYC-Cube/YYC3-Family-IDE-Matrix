/**
 * @file: agent/logger.ts
 * @description: [重导出] Agent 模块日志 — 从统一日志服务 logger 重导出
 * @deprecated: 请从 ../logger 直接导入
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: deprecated
 * @tags: [logger],[deprecated]
 */

export { logger, createLogger, setLogLevel, getLogLevel } from "../logger";
export type { Logger, LogLevel } from "../logger";
export { default } from "../logger";
