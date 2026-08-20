/**
 * @file: services/__tests__/logger.test.ts
 * @description: Logger 服务单元测试
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [test],[logger],[unit]
 *
 * brief: 测试统一日志服务的功能
 *
 * details:
 * - 测试日志级别过滤
 * - 测试 createLogger 前缀功能
 * - 测试动态设置日志级别
 * - 测试所有级别方法存在
 *
 * test-target: services/logger.ts
 * coverage: 90%+
 * notes: 使用 Vitest
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { logger, createLogger, setLogLevel, getLogLevel } from "../logger";

describe("Logger Service", () => {
  beforeEach(() => {
    setLogLevel("debug");
    vi.restoreAllMocks();
  });

  describe("基础功能", () => {
    it("应包含所有日志级别方法", () => {
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("setLogLevel 和 getLogLevel 应正确工作", () => {
      setLogLevel("warn");
      expect(getLogLevel()).toBe("warn");

      setLogLevel("debug");
      expect(getLogLevel()).toBe("debug");
    });
  });

  describe("日志级别过滤", () => {
    beforeEach(() => {
      vi.spyOn(console, "debug").mockImplementation(() => {});
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("debug 级别时应输出所有日志", () => {
      setLogLevel("debug");
      logger.debug("test debug");
      logger.info("test info");
      logger.warn("test warn");
      logger.error("test error");

      expect(console.debug).toHaveBeenCalledTimes(1);
      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("info 级别时应过滤 debug", () => {
      setLogLevel("info");
      logger.debug("test debug");
      logger.info("test info");
      logger.warn("test warn");
      logger.error("test error");

      expect(console.debug).toHaveBeenCalledTimes(0);
      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("warn 级别时应只输出 warn 和 error", () => {
      setLogLevel("warn");
      logger.debug("test debug");
      logger.info("test info");
      logger.warn("test warn");
      logger.error("test error");

      expect(console.debug).toHaveBeenCalledTimes(0);
      expect(console.info).toHaveBeenCalledTimes(0);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("error 级别时应只输出 error", () => {
      setLogLevel("error");
      logger.debug("test debug");
      logger.info("test info");
      logger.warn("test warn");
      logger.error("test error");

      expect(console.debug).toHaveBeenCalledTimes(0);
      expect(console.info).toHaveBeenCalledTimes(0);
      expect(console.warn).toHaveBeenCalledTimes(0);
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("createLogger", () => {
    beforeEach(() => {
      vi.spyOn(console, "info").mockImplementation(() => {});
      setLogLevel("debug");
    });

    it("应创建带前缀的日志实例", () => {
      const log = createLogger("TestModule");
      log.info("hello");

      expect(console.info).toHaveBeenCalledTimes(1);
      const callArgs = (console.info as any).mock.calls[0];
      expect(callArgs[0]).toContain("TestModule");
    });

    it("不同前缀的实例应独立", () => {
      const log1 = createLogger("ModuleA");
      const log2 = createLogger("ModuleB");

      log1.info("from A");
      log2.info("from B");

      expect(console.info).toHaveBeenCalledTimes(2);
    });
  });

  describe("多参数支持", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      setLogLevel("debug");
    });

    it("应支持多个参数", () => {
      const error = new Error("test error");
      logger.error("出错了:", error, { code: 500 });

      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });
});
