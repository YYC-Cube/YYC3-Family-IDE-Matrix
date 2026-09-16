/**
 * @file: vite.config.ts
 * @description: Vite 构建配置 — sourcemap 禁用 + 分包策略 + base 可配
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-28
 * @updated: 2026-08-28
 * @status: active
 * @tags: [vite,config,build,optimization]
 */

import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react() as never],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@services": path.resolve(__dirname, "./services"),
      "@components": path.resolve(__dirname, "./components"),
      "@stores": path.resolve(__dirname, "./stores"),
      "@hooks": path.resolve(__dirname, "./hooks"),
      "@lib": path.resolve(__dirname, "./lib"),
      "@utils": path.resolve(__dirname, "./utils"),
      "@types": path.resolve(__dirname, "./types"),
      // —— Monaco 0.56 worker 别名（exports 通配不跨目录，深路径 Node 无法解析）——
      // alias 目标必须为磁盘绝对路径（bare specifier 仍会被 exports 拦截）；
      // ?worker&url 由 Vite 构建期出独立 worker chunk（测试环境由 vi.mock 接管）
      "monaco-worker:json": path.resolve(
        __dirname, "node_modules/monaco-editor/esm/vs/language/json/json.worker.js?worker&url"),
      "monaco-worker:css": path.resolve(
        __dirname, "node_modules/monaco-editor/esm/vs/language/css/css.worker.js?worker&url"),
      "monaco-worker:html": path.resolve(
        __dirname, "node_modules/monaco-editor/esm/vs/language/html/html.worker.js?worker&url"),
      "monaco-worker:ts": path.resolve(
        __dirname, "node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js?worker&url"),
      "monaco-worker:editor": path.resolve(
        __dirname, "node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker&url"),
    },
  },

  // base 路径可配（支持子路径 CDN 部署）
  base: process.env.VITE_BASE ?? "/",

  build: {
    // 安全：禁用 sourcemap（审计 R3/A3）
    sourcemap: false,

    // 产物输出
    outDir: "dist",

    // 分包策略：将大型库分离为独立 chunk
    // Vite 8（Rollup 4+）manualChunks 仅接受函数式；对象映射已从类型中移除
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 依赖 → vendor chunk 映射（顺序敏感：先匹配先归组）
          const vendors: Array<[string, string[]]> = [
            ["vendor-react", ["react", "react-dom"]],
            ["vendor-zustand", ["zustand"]],
            ["vendor-recharts", ["recharts"]],
            [
              "vendor-xterm",
              [
                "@xterm/xterm",
                "@xterm/addon-fit",
                "@xterm/addon-web-links",
                "@xterm/addon-search",
                "@xterm/addon-unicode11",
              ],
            ],
            ["vendor-yjs", ["yjs", "y-websocket", "y-indexeddb", "y-monaco"]],
            ["vendor-monaco", ["monaco-editor", "@monaco-editor/react"]],
            ["vendor-security", ["dompurify"]],
          ];
          // node_modules 内的包名提取（支持 @scope/name）
          const m = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
          if (!m) return undefined;
          const pkg = m[1];
          for (const [chunk, pkgs] of vendors) {
            if (pkgs.includes(pkg)) return chunk;
          }
          return undefined;
        },
      },
    },

    // 单 chunk 警戒线（1MB，仅警告不阻断）
    chunkSizeWarningLimit: 1024,
  },

  // 开发服务器
  server: {
    port: 3030,
    strictPort: false,
  },

  // 测试环境
  test: {
    globals: true,
  },
});
