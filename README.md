<!--
  file: README.md
  description: YYC³ Family IDE Matrix · 项目总览与快速上手
  author: YanYuCloudCube Team <admin@0379.email>
  version: v3.0.0
  created: 2026-08-19
  updated: 2026-08-28
  status: active
  tags: [docs,overview,quickstart]
-->

<p align="center">
  <img src="public/yyc3-family.png" alt="YYC³ Family — 智能代码开发工作台" />
</p>

<h1 align="center">YYC³ Family IDE Matrix</h1>

<div align="center">

> **YanYuCloudCube** · 言启象限 · 语枢未来
>
> **设计哲学**：以「深蓝 + 青色赛博朋克」为视觉基因，以「数据洞察 → 快速决策」为目标，
> 构建**高信息密度、低认知负担、强交互反馈**的智能开发环境。

</div>

---

## 🏷️ 徽章

<div align="center">

[![CI Pipeline](https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/actions/workflows/ide-test-coverage.yml/badge.svg)](https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/actions/workflows/ide-test-coverage.yml)
[![CodeQL](https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/actions/workflows/codeql.yml/badge.svg)](https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/actions/workflows/codeql.yml)
[![Tests](https://img.shields.io/badge/tests-1056%20passing-10b981?style=flat-square)](ide/)
[![tsc](https://img.shields.io/badge/tsc-0%20errors-06b6d4?style=flat-square)](ide/tsconfig.json)
[![Audit](https://img.shields.io/badge/audit-0%20vulns-10b981?style=flat-square)](ide/package.json)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](ide/package.json)

</div>

---

## 📌 项目简介

**YYC³ Family IDE Matrix** 是 YanYuCloudCube 家族的**智能代码开发工作台**——从 MCP 协议接入、多 Agent 编排、多文件编辑、实时预览到 Yjs 协作、沙箱化终端的**全链路 IDE 产品**。

### 核心能力域

| 域 | 位置 | 说明 |
| --- | --- | --- |
| **多文件编辑** | `workbench/` + `stores/` | 文件树 + Tab 切换 + Monaco 编辑器 |
| **实时预览** | `SandpackPreview.tsx` | Sandpack 热更新（React/TS/静态） |
| MCP 服务栈 | `services/mcp/` | Model Context Protocol 客户端（2026-07-28 规范） |
| 多 Agent 编排 | `components/agent/` + `hooks/` | Planner→Coder→Tester→Reviewer 流水线 |
| AI 补全 | `services/AICompletionService` | Monaco 内联补全（经代理适配层） |
| LLM 调用层 | `services/llm/` | Provider 管理 + 降级 + 限流 + **代理适配** |
| 安全套件 | `services/security/` | Vault（PBKDF2 口令派生）+ Sanitizer + CSRF + 加密 |
| Yjs 协作 | `services/collab/` + `collab-server/` | CRDT 同步 + Awareness + 鉴权 + TTL + 持久化 |
| 沙箱终端 | `services/terminal/` | 策略闸门 + E2B/CF + **审计持久化** |
| 面板宿主 | `components/panel-host/` | 布局树 + DnD + 浮动窗口 + Pin |
| 可视化体系 | `components/visualization/` | 主题令牌 + 图表 + Zod + LTTB |
| 桌面端 | `electron/` | Electron 脚手架（IPC 白名单 + contextIsolation） |

---

## 🚀 快速开始

```bash
cd ide
pnpm install
pnpm dev              # 开发服务器（多文件编辑 + Sandpack 预览 + 终端）
pnpm test             # 1056 用例
pnpm collab:server    # 协作服务端（可选）
pnpm electron:dev     # Electron 桌面（可选）
```

---

## 📦 仓库结构

```
YYC3-Family-IDE-Matrix/
├── README.md                        # ← 本文档
├── docs/                            # 文档中心
│   ├── architecture.md              # 架构设计（分层/域清单/依赖图）
│   ├── developer-guide.md           # 开发者指南（环境/规范/10个核心模块）
│   ├── visualization-spec.md        # 可视化体系规范（§1-§12）
│   └── evolution-plan.md            # 功能演进方案（Phase 1-3 ✅）
├── ide/                             # @yyc3/ide 工作台工程
│   ├── src/main.tsx                 # 入口（可观测性 + ErrorBoundary）
│   ├── components/                  # UI 层（8 域）
│   │   ├── workbench/               # 工作台（多文件编辑 + Sandpack + 组装）
│   │   ├── panel-host/              # 面板宿主（布局/DnD/浮动/上下文）
│   │   ├── agent/                   # Agent 面板
│   │   ├── terminal/                # 终端面板
│   │   ├── visualization/           # 可视化体系
│   │   └── ...                      # model-settings / plugins / snapshot
│   ├── services/                    # 服务层（9 域）
│   │   ├── mcp/                     # MCP 客户端
│   │   ├── llm/                     # LLM + 代理适配
│   │   ├── security/                # 安全套件
│   │   ├── storage/                 # 存储全套
│   │   ├── terminal/                # 沙箱终端
│   │   ├── collab/                  # Yjs 协作
│   │   ├── plugins/                 # 插件系统
│   │   └── agent/                   # Agent 技能
│   ├── stores/                      # 状态（14 Store 含 FileStore）
│   ├── hooks/ llm/ lib/ i18n/       # 上下文工程 / 编辑器基础设施 / 国际化
│   ├── collab-server/               # y-websocket 兼容服务端
│   ├── electron/                    # Electron 桌面壳
│   ├── vite.config.ts               # 构建配置（sourcemap禁用 + 分包）
│   └── .env.example                 # 环境变量样例
├── archive/                         # 单体快照（只读）
│   ├── MIGRATION.md                 # 回迁路线图
│   └── ide-monolith-2026-03/
└── .github/
    ├── workflows/
    │   ├── ide-test-coverage.yml    # CI 流水线（安全+测试+构建）
    │   └── codeql.yml               # CodeQL 安全扫描
    └── dependabot.yml               # 依赖自动更新
```

---

## 🗺️ 文档导航

| 文档 | 位置 | 内容 |
| --- | --- | --- |
| **本文档** | [`README.md`](README.md) | 项目总览 / 快速开始 |
| 架构设计 | [`docs/architecture.md`](docs/architecture.md) | 分层 / 域清单 / 依赖图 / 约束 |
| 开发者指南 | [`docs/developer-guide.md`](docs/developer-guide.md) | 10 个核心模块 / 调试 / 部署 |
| 可视化规范 | [`docs/visualization-spec.md`](docs/visualization-spec.md) | 主题令牌 / 图表契约 / 性能 |
| 演进方案 | [`docs/evolution-plan.md`](docs/evolution-plan.md) | Phase 1-3 ✅ / 下一步建议 |
| 回迁路线图 | [`archive/MIGRATION.md`](archive/MIGRATION.md) | 批次状态 / 审计修复矩阵 |
| 协作服务端 | [`ide/collab-server/README.md`](ide/collab-server/README.md) | 部署 / TTL / 持久化 / 鉴权 |

---

## 📝 变更历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v3.0.0 | 2026-08-28 | Phase 1-3 全部完成：多文件编辑 + Sandpack 预览 + AI 补全 + Electron 脚手架 |
| v2.0.0 | 2026-08-20 | 文档架构重构：总览精简为导航入口 + docs/ 4 文件 |
| v1.0.0 | 2026-08-19 | 初始版本 |

---

<div align="center">

> 「***YanYuCloudCube***」· All things converge in cloud pivot

*© 2025-2026 YanYuCloudCube™ · YYC³ Family IDE Matrix · All Rights Reserved.*

</div>
