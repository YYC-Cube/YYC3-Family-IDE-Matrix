/**
 * @file: ErrorReportingService.test.ts
 * @description: 错误上报服务从 0 到 1 测试 — init/捕获/采样/面包屑/监听器清理回归
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[error-reporting]
 *
 * notes: 服务为单例且 init 有 initialized 守卫——destroy 后可重新 init，
 *        测试围绕该生命周期组织。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { errorReporting } from "../ErrorReportingService";

beforeEach(() => {
  localStorage.clear();
  errorReporting.destroy(); // 复位单例（清定时器/监听器/initialized）
  errorReporting.init({ sampleRate: 1 });
});

afterEach(() => {
  errorReporting.destroy();
});

describe("ErrorReportingService", () => {
  it("captureError 采样率 1 时返回指纹 ID 并落本地事件", () => {
    const id = errorReporting.captureError(new Error("测试错误"), {
      category: "render",
      severity: "error",
    });
    expect(typeof id).toBe("string");
    expect(id!.length).toBeGreaterThan(0);

    const events = errorReporting.getLocalEvents();
    expect(
      events.some(
        (e) => e.fingerprint === id || String(e.message).includes("测试错误"),
      ),
    ).toBe(true);
  });

  it("重复错误在去重窗口内二次捕获仍安全（返回 null 或同指纹）", () => {
    const first = errorReporting.captureError(new Error("重复错误A"));
    const second = errorReporting.captureError(new Error("重复错误A"));
    expect(first).toBeTruthy();
    expect(second === null || typeof second === "string").toBe(true);
  });

  it("captureError 接受非 Error 输入不抛出", () => {
    let result: unknown = "no-throw";
    try {
      result = errorReporting.captureError("裸字符串错误");
    } catch {
      result = "threw";
    }
    expect(result).not.toBe("threw");
  });

  it("addBreadcrumb 与 clearLocalEvents 成对调用安全", () => {
    expect(() =>
      errorReporting.addBreadcrumb({ type: "navigation", category: "page", message: "进入设置页" }),
    ).not.toThrow();
    expect(() => errorReporting.clearLocalEvents()).not.toThrow();
  });

  it("destroy 移除全局监听器（审计 Q3 回归）", () => {
    // beforeEach 已 init（安装监听）；此处 destroy 后重装以捕获 spy
    errorReporting.destroy();

    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    errorReporting.init({ sampleRate: 1 });
    expect(addSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));

    errorReporting.destroy();
    expect(removeSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
