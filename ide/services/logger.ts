/**
 * @file: services/logger.ts
 * @description: "[转发] logger 真身已下沉至 lib/logger.ts（审计架构#3 分层修复）"
 * @deprecated: 请从 ../lib/logger 导入
 */

export {
  logger,
  createLogger,
  setLogLevel,
  getLogLevel,
  type Logger,
  type LogLevel,
} from "../lib/logger";

export { default } from "../lib/logger";
