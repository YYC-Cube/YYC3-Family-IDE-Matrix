/**
 * @file: types/vitest.d.ts
 * @description: Vitest 模块 & 全局类型兜底声明 — 解决 IDE 找不到 vitest 类型报错
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-19
 * @updated: 2026-08-19
 * @status: active
 * @tags: [type],[vitest],[ambient]
 *
 * brief: 当 node_modules/vitest 未被 TSServer 正确加载时，提供一份最小的 ambient 模块声明
 *
 * details:
 * - 仅用于 IDE 类型检查，运行时以 node_modules 真实安装包为准
 * - 覆盖: vi, describe, it, expect, Mock, MockInstance 等最常用符号
 * - vitest/globals 全局符号 (describe/it/beforeEach...) 直接挂到 globalThis
 *
 * dependencies: none (纯 ambient, 零运行时)
 * notes: 如果在 node_modules 里已安装 vitest，真实类型会自动覆盖此文件
 */

// ------------------------------------------------------------------
// 1. 声明 vitest 模块本身 (解决 "找不到模块 vitest" 报错)
// ------------------------------------------------------------------
declare module "vitest" {
  // —— Mock 类型 ——
  export type Mock<TArgs extends any[] = any, TReturn = any> = {
    (this: any, ...args: TArgs): TReturn;
    mock: {
      calls: TArgs[];
      results: { type: "return" | "throw"; value: TReturn }[];
      lastCall?: TArgs;
    };
    mockClear(): void;
    mockReset(): void;
    mockRestore(): void;
    mockImplementation(fn: (...args: TArgs) => TReturn): Mock<TArgs, TReturn>;
    mockImplementationOnce(fn: (...args: TArgs) => TReturn): Mock<TArgs, TReturn>;
    mockReturn(value: TReturn): Mock<TArgs, TReturn>;
    mockReturnOnce(value: TReturn): Mock<TArgs, TReturn>;
    mockRejected(value: unknown): Mock<TArgs, Promise<TReturn>>;
    mockResolved(value: TReturn): Mock<TArgs, Promise<TReturn>>;
  };
  export type MockInstance<TArgs extends any[] = any, TReturn = any> = Mock<TArgs, TReturn>;

  // —— vi 对象 ——
  export const vi: {
    mock(path: string, factory?: () => any): void;
    unmock(path: string): void;
    clearAllMocks(): void;
    resetAllMocks(): void;
    restoreAllMocks(): void;
    mockClearAllMocks(): void;
    useFakeTimers(): void;
    useRealTimers(): void;
    runAllTimers(): void;
    advanceTimersByTime(ms: number): void;
    fn<T = unknown>(): Mock<any, T>;
    fn<TFn extends (...args: any[]) => any>(impl?: TFn): Mock<any, ReturnType<TFn>>;
    spyOn<T extends object, K extends keyof T>(
      obj: T,
      key: K,
      accessType?: "get" | "set" | "method"
    ): Mock<any, any>;
    stubGlobal(name: string, value: unknown): void;
    unstubAllGlobals(): void;
  };

  // —— Hook 函数类型 ——
  type HookCleanup = void | Promise<void> | (() => void);
  type HookFn = (
    context: import("./context").TaskContext
  ) => HookCleanup;
  export const beforeEach: (fn: HookFn, timeout?: number) => void;
  export const afterEach: (fn: HookFn, timeout?: number) => void;
  export const beforeAll: (fn: HookFn, timeout?: number) => void;
  export const afterAll: (fn: HookFn, timeout?: number) => void;

  // —— 测试函数类型 ——
  export interface TestContext {
    expect: ExpectStatic;
  }
  export const it: It;
  export const test: It;
  export const describe: Describe;

  // —— expect 断言库类型 ——
  export interface ExpectStatic {
    <T = unknown>(actual: T): Assertion<T>;
    assertions(count: number): void;
    hasAssertions(): void;
    any(constructor: unknown): boolean;
    anything(): boolean;
    arrayContaining(arr: unknown[]): unknown[];
    objectContaining(obj: Record<string, unknown>): Record<string, unknown>;
    stringContaining(str: string): string;
    stringMatching(re: RegExp): string;
  }
  export interface Assertion<T = unknown> {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeDefined(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNaN(): void;
    toBeGreaterThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThan(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toBeCloseTo(n: number, digits?: number): void;
    toContain(item: unknown): void;
    toContainEqual(item: unknown): void;
    toHaveLength(n: number): void;
    toHaveProperty(key: string, value?: unknown): void;
    toMatch(regexp: RegExp): void;
    toMatchObject(obj: Record<string, unknown>): void;
    toThrow(message?: string | RegExp): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(n: number): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    toHaveBeenLastCalledWith(...args: unknown[]): void;
    toHaveReturned(): void;
    toReturn(...args: unknown[]): void;
    toEqualUnordered(arr: unknown[]): void;
    resolves: Assertion<Promise<Awaited<T>>>;
    rejects: Assertion<Promise<any>>;
    not: Assertion<T>;
  }
  export interface Describe {
    (name: string, fn: () => void): void;
    only(name: string, fn: () => void): void;
    skip(name: string, fn: () => void): void;
    each(rows: any[]): (name: string, fn: (...args: any[]) => any, timeout?: number) => void;
  }
  export interface It {
    (name: string, fn?: (context: TestContext) => void | Promise<void>, timeout?: number): void;
    only(name: string, fn?: (context: TestContext) => void | Promise<void>, timeout?: number): void;
    skip(name: string, fn?: (context: TestContext) => void | Promise<void>, timeout?: number): void;
    todo(name: string): void;
    each(rows: any[]): (name: string, fn: (...args: any[]) => any, timeout?: number) => void;
  }

  export const expect: ExpectStatic;
  export const assert: ExpectStatic;
}

// ------------------------------------------------------------------
// 2. 全局注入 vitest globals (配合 vitest.config.ts globals: true)
// ------------------------------------------------------------------
declare global {
  namespace NodeJS {
    interface Global {}
  }
  const vi: typeof import("vitest").vi;
  const describe: typeof import("vitest").describe;
  const it: typeof import("vitest").it;
  const test: typeof import("vitest").test;
  const expect: typeof import("vitest").expect;
  const assert: typeof import("vitest").assert;
  const beforeEach: typeof import("vitest").beforeEach;
  const afterEach: typeof import("vitest").afterEach;
  const beforeAll: typeof import("vitest").beforeAll;
  const afterAll: typeof import("vitest").afterAll;
  type Mock<TArgs extends any[] = any, TReturn = any> = import("vitest").Mock<TArgs, TReturn>;
  type MockInstance<TArgs extends any[] = any, TReturn = any> = Mock<TArgs, TReturn>;
}

export {};
