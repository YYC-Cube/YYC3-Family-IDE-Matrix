/**
 * @file: types/vitest.d.ts
 * @description: Vitest 全局类型注入（配合 vitest.config.ts globals: true）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-08-19
 * @updated: 2026-08-20
 * @status: active
 * @tags: [type],[vitest],[ambient]
 *
 * brief: 仅为 vitest globals 提供类型；模块类型一律来自 node_modules 真实 vitest 包
 *
 * details（v2.0.0 修复）:
 * - 删除 v1.0.0 的 `declare module "vitest"` 伪造兜底 —— ambient 模块声明会覆盖
 *   真实包类型，其 Mock 使用了不存在的方法名（mockReturn/mockResolved），
 *   导致所有测试 mockResolvedValue/mockReturnValue 等类型报错
 * - 全局段通过 import("vitest") 直接引用真实包类型
 * - node_modules/vitest 缺失时（如全新克隆未安装依赖），tsc 将如实报
 *   "Cannot find module 'vitest'" —— 这是期望行为，提示先 pnpm install
 */

declare global {
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
  type Mock<TArgs extends any[] = any, TReturn = any> = import("vitest").Mock<
    TArgs,
    TReturn
  >;
  type MockInstance<TArgs extends any[] = any, TReturn = any> = Mock<TArgs, TReturn>;
}

export {};
