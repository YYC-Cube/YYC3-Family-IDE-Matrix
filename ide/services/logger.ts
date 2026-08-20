/**
 * @file: services/logger.ts
 * @description: 统一日志服务 — 提供多级别、可配置的日志接口
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [service],[logger],[util]
 *
 * brief: 统一日志服务，支持多级别、模块前缀、动态配置
 *
 * details:
 * - 提供 debug/info/warn/error 四个级别
 * - 支持 createLogger(prefix) 创建带模块前缀的日志实例
 * - 支持动态设置日志级别
 * - 生产环境可禁用 debug 级别
 * - 与 console API 兼容，可直接替换
 *
 * usage:
 * ```
 * import { logger, createLogger } from './services/logger';
 * const log = createLogger('MyModule');
 * log.info('initialized');
 * ```
 *
 * dependencies: 无
 * exports: logger, createLogger, LogLevel, Logger
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  setLevel: (level: LogLevel) => void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

function formatMessage(prefix: string, level: string, args: unknown[]): unknown[] {
  const timestamp = new Date().toISOString();
  return [`[${timestamp}] [${level.toUpperCase()}] [${prefix}]`, ...args];
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function createBaseLogger(prefix: string): Logger {
  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) {
        console.debug(...formatMessage(prefix, "debug", args));
      }
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) {
        console.info(...formatMessage(prefix, "info", args));
      }
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) {
        console.warn(...formatMessage(prefix, "warn", args));
      }
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) {
        console.error(...formatMessage(prefix, "error", args));
      }
    },
    setLevel: (level: LogLevel) => {
      currentLevel = level;
    },
  };
}

/**
 * 根日志实例（无前缀）
 */
export const logger: Logger = createBaseLogger("app");

/**
 * 创建带模块前缀的日志实例
 * @param prefix 模块前缀
 * @returns Logger 实例
 */
export function createLogger(prefix: string): Logger {
  return createBaseLogger(prefix);
}

/**
 * 设置全局日志级别
 * @param level 日志级别
 */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * 获取当前日志级别
 */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

export default logger;
