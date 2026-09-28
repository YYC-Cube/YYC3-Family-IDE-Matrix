/**
 * @file: eslint.config.mjs
 * @description: ESLint 10 flat config — @eslint/js + typescript-eslint(非类型感知) + react-hooks
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-09-28
 * @updated: 2026-09-28
 * @status: active
 * @tags: [eslint,flat-config,lint,quality-gate]
 *
 * brief: 取代 .eslintrc.json（ESLint 10 仅支持 flat config）。
 *        typescript-eslint v8 官方支持 TS >=4.8.4 <6.1.0 —— 项目钉 typescript ~6.0.3。
 *        非类型感知 lint（无 projectService）：类型正确性由 tsc --noEmit 门禁负责。
 *
 * notes:
 * - eslint-plugin-react 暂缺席：全系（latest 7.37.5）peer 最高 ^9.7，不兼容 ESLint 10；
 *   其 rules context API（getFilename）在 ESLint 10 已移除。待上游发布 ESLint 10
 *   适配版本后回归该插件并补齐 react/* 规则层。
 */

import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

const hooksFlat = reactHooks.configs.flat ?? reactHooks.configs;

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "collab-server/dist/**",
      "**/*.d.ts",
      "archive/**",
    ],
  },

  // 基础层：JS 推荐规则 + 全局环境
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx,jsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-console": "off",
    },
  },

  // React Hooks 层（ESLint 10 原生支持，捕获 React 正确性类缺陷）
  ...(hooksFlat["recommended-latest"] ?? hooksFlat.recommended
    ? [hooksFlat["recommended-latest"] ?? hooksFlat.recommended]
    : []),

  // 测试层：vitest 全局（describe/it/expect/vi…）
  {
    files: ["**/__tests__/**/*.{ts,tsx,js,mjs}", "**/*.test.{ts,tsx,js,mjs}", "**/*.spec.{ts,tsx,js,mjs}", "test/**/*.{ts,tsx,js,mjs}"],
    languageOptions: {
      globals: { ...globals.vitest, ...globals.node },
    },
  },

  // TypeScript 层（parser-only，非类型感知）
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      // typescript-eslint 准则：TS/TSX 关闭 no-undef —— 标识符存在性由 TS 编译器门禁负责
      // （避免 Mock/RequestInit/NodeJS 等类型位全局被误报）
      "no-undef": "off",
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
];
