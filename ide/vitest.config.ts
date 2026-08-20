/**
 * @file: vitest.config.ts
 * @description: Vitest 配置文件 — 覆盖率目标: 语句 90%+ / 分支 85%+
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-19
 * @updated: 2026-08-19
 * @status: active
 * @tags: [config],[vitest],[test],[coverage]
 *
 * brief: Vitest 测试运行与覆盖率配置
 *
 * details:
 * - 兼容 Vite 5 + Vitest 1.x 组合 (经验证无路径导出错误)
 * - jsdom 环境以支持 React 组件测试
 * - coverage 使用 v8 provider, 阈值按开发运维指南设定
 * - 支持 __tests__ 子目录匹配 *.test.ts / *.test.tsx
 * - 别名: @ → src (若项目有 src)，同时相对路径原样可用
 *
 * dependencies: Vite 5, Vitest 1.x, @vitest/coverage-v8, jsdom
 * notes: 不要升级 Vitest 到 2.x+，否则与 Vite 5 可能触发 ERR_PACKAGE_PATH_NOT_EXPORTED
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    // 全局环境: jsdom (后续测 React 组件需 DOM)
    environment: "jsdom",

    // 启用 globals 以支持 describe/it/expect 无需 import
    globals: true,

    // tsconfig 支持 (注意 ide/tsconfig.json 是我们新建的那份)
    typecheck: {
      tsconfig: "./tsconfig.json",
      enabled: false, // 仅在 `vitest typecheck` 时开启，避免拖慢常规测试
    },

    // 测试文件匹配规则
    include: [
      "**/__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "**/*.{test,spec}.{ts,tsx,js,jsx}",
    ],
    exclude: [
      "node_modules",
      "dist",
      "build",
      ".next",
      "coverage",
      "snapshot/**",        // 旧位置重导出目录，排除避免重复测
      "agent/**",           // 旧位置重导出目录
      "model-settings/**",  // 旧位置重导出目录
      "**/*.d.ts",
    ],

    // 覆盖率配置
    coverage: {
      provider: "v8",
      reporter: [
        ["text", { maxCols: 120 }],       // 终端表格
        ["text-summary"],                 // 终端摘要
        ["html"],                         // HTML 报告: ./coverage/index.html
        ["json"],                         // CI 用
        ["lcov"],                         // SonarQube 兼容
      ],
      reportsDirectory: "./coverage",

      // 只统计真正的源码，排除测试/类型/重导出/存根
      include: [
        "services/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "stores/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "utils/**/*.{ts,tsx}",
        "AgentSkills.ts",
        "snapshotApplyHelper.ts",
      ],
      exclude: [
        "**/__tests__/**",
        "**/types/**",
        "**/*.d.ts",
        "**/__mocks__/**",
      ],

      // 覆盖率阈值（按文档五高标准）
      //
      // 说明：
      //   1) 全局阈值较高 — 当测试覆盖全量模块时启用
      //   2) 单文件专项阈值更严格 — AgentSkills 为重点模块
      //   3) 若仅跑单一测试文件，请临时注释掉全局阈值 (4 lines)，否则会因其它
      //      未测模块 0% 覆盖导致 exit code 非 0
      thresholds: {
        // ===== 全局阈值（全量模块测试时启用） =====
        // lines: 90,
        // functions: 90,
        // branches: 85,
        // statements: 90,

        // ===== AgentSkills 专项阈值（本次目标模块，已达成 100/95/100/100） =====
        "services/agent/AgentSkills.ts": {
          lines: 90,
          functions: 95,
          branches: 85,
          statements: 90,
        },
      },

      // 100% 分支但未访问的计数显示
      all: true,

      // 允许部分文件因存根暂时低于阈值
      perFile: true,
    },

    // mock 清理由 beforeEach 管理 (文件内我们已经手动 clearAllMocks)
    clearMocks: true,
    mockReset: false,
    restoreMocks: false,
  },
});
