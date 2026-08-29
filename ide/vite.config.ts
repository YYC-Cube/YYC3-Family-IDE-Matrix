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

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

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
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心
          "vendor-react": ["react", "react-dom"],
          // 状态管理
          "vendor-zustand": ["zustand"],
          // 图表（可进一步 lazy）
          "vendor-recharts": ["recharts"],
          // xterm 终端
          "vendor-xterm": [
            "@xterm/xterm",
            "@xterm/addon-fit",
            "@xterm/addon-web-links",
            "@xterm/addon-search",
            "@xterm/addon-unicode11",
          ],
          // Yjs 协作全家桶
          "vendor-yjs": ["yjs", "y-websocket", "y-indexeddb", "y-monaco"],
          // Monaco（重依赖，独立分片）
          "vendor-monaco": ["monaco-editor", "@monaco-editor/react"],
          // 安全
          "vendor-security": ["dompurify"],
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
