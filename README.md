<!--
  file: README.md
  description: YYC³ Family IDE Matrix · 项目总览与快速上手
  author: YanYuCloudCube Team <admin@0379.email>
  version: v2.0.0
  created: 2026-08-19
  updated: 2026-08-20
  status: active
  tags: [docs,overview,quickstart]
-->

<p align="center">
  <img src="public/yyc3-family.png" alt="YYC³ Family — 可视化体系设计" />
</p>

<h1 align="center">YYC³ Family IDE Matrix</h1>

<div align="center">

> **YanYuCloudCube** · 言启象限 · 语枢未来
>
> **设计哲学**：以「深蓝 + 青色赛博朋克」为视觉基因，以「数据洞察 → 快速决策」为目标，
> 构建**高信息密度、低认知负担、强交互反馈**的智能可视化系统。

</div>

---

## 🏷️ 徽章

<div align="center">

[![CI · Test & Coverage](https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/actions/workflows/ide-test-coverage.yml/badge.svg)](https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/actions/workflows/ide-test-coverage.yml)
[![Tests](https://img.shields.io/badge/tests-1040%20passing-10b981?style=flat-square)](ide/)
[![tsc](https://img.shields.io/badge/tsc-0%20errors-06b6d4?style=flat-square)](ide/tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](ide/package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-3b82f6?style=flat-square)](ide/package.json)

</div>

---

## 📌 项目简介

**YYC³ Family IDE Matrix** 是 YanYuCloudCube 家族的**智能代码开发工作台**。本文档体系覆盖从 MCP 协议接入、多 Agent 编排、上下文工程、安全存储到 Yjs 实时协作、沙箱化终端的**全链路工程标准**。

### 核心能力域

| 域 | 位置 | 说明 |
| --- | --- | --- |
| MCP 服务栈 | `ide/services/mcp/` | Model Context Protocol 客户端（2026-07-28 无状态规范 v1.2.0） |
| 上下文工程 | `ide/llm/` | 压缩引擎 / 策略设计器 / 摘要生成 / 上下文收集 |
| LLM 调用层 | `ide/services/llm/` | Provider 管理 / Chat / SSE 流式 / 自动降级 / 限流熔断 |
| 多 Agent 编排 | `ide/components/agent/` + `ide/hooks/` | 四阶段流水线（Planner→Coder→Tester→Reviewer） |
| 安全套件 | `ide/services/security/` | APIKeyVault / Sanitizer / CsrfProtection / EncryptionService |
| 存储套件 | `ide/services/storage/` | IndexedDB / 备份 / 版本 / 三方合并 / 云同步 / 迁移 |
| 插件系统 | `ide/services/plugins/` | PluginManager / 事件总线 / 7 内置插件 / 市场 |
| Yjs 协作 | `ide/services/collab/` | CRDT 文档同步 / Awareness / y-monaco / 配置化 |
| 沙箱终端 | `ide/services/terminal/` | 策略闸门 / E2B·Cloudflare 双供应商 / DryRun |
| 面板宿主 | `ide/components/panel-host/` | 布局树编辑 / DnD / Pin / 浮动窗口 / 最大化 |
| IDE 工作台 | `ide/components/workbench/` | Monaco × PanelShell × 真实面板组装 |
| 可视化体系 | `ide/components/visualization/` | 主题令牌 / 图表 / Zod 校验 / LTTB 降采样 |

---

## 🚀 快速开始

```bash
# 1. 安装依赖（pnpm ≥ 8）
cd ide && pnpm install

# 2. 启动开发服务器
pnpm dev

# 3. 运行测试（1040 用例）
pnpm test

# 4. 类型检查 / 覆盖率
pnpm exec tsc --noEmit
pnpm test:coverage

# 5. 启动协作服务端（可选）
pnpm collab:server
```

> 环境变量样例见 [`ide/.env.example`](ide/.env.example)

---

## 📦 仓库结构

```
YYC3-Family-IDE-Matrix/
├── README.md                        # ← 本文档 · 项目总览
├── docs/                            # 文档中心
│   ├── README.md                    # 文档索引
│   ├── architecture.md              # 架构设计（分层/依赖图/域清单）
│   ├── developer-guide.md           # 开发者指南（环境/规范/调试/部署）
│   └── visualization-spec.md        # 可视化体系规范（§1-§12）
├── public/                          # 品牌资源
├── ide/                             # @yyc3/ide 工作台工程（唯一生产线）
│   ├── components/                  # UI 层（8 域）
│   │   ├── agent/                   # Agent 市场/编排器/流水线/ModelRegistry
│   │   ├── model-settings/          # 模型设置面板
│   │   ├── panel-host/              # 面板宿主（布局/DnD/浮动/上下文）
│   │   ├── plugins/                 # 插件市场面板
│   │   ├── snapshot/                # 快照 Diff 模态
│   │   ├── terminal/                # 终端面板（REPL/沙箱消费端）
│   │   ├── visualization/           # 可视化体系（主题/图表/校验）
│   │   └── workbench/               # IDE 工作台组装
│   ├── services/                    # 服务层（9 域）
│   │   ├── agent/                   # Agent 技能
│   │   ├── collab/                  # Yjs 协作
│   │   ├── llm/                     # LLM 调用与降级
│   │   ├── mcp/                     # MCP 客户端
│   │   ├── plugins/                 # 插件系统
│   │   ├── security/                # 安全套件
│   │   ├── storage/                 # 存储套件
│   │   └── terminal/                # 沙箱终端
│   ├── stores/                      # Zustand 状态（14 Store）
│   ├── hooks/                       # 自定义 Hooks
│   ├── lib/                         # 编辑器基础设施
│   ├── llm/                         # 上下文工程
│   ├── i18n/                        # 国际化
│   ├── collab-server/               # y-websocket 兼容协作服务端
│   ├── constants/                   # 共享常量
│   ├── types/                       # 类型定义
│   ├── utils/                       # 工具函数
│   ├── test-setup/                  # 测试全局 setup
│   ├── .env.example                 # 环境变量样例
│   └── tsconfig.json / vitest.config.ts / package.json
├── archive/
│   ├── MIGRATION.md                 # 单体回迁路线图（批次/规则/状态）
│   └── ide-monolith-2026-03/       # 2026-03 单体快照（只读 · 渐进回迁源）
├── docs/README.md                   # docs/ 目录说明
└── .github/workflows/
    └── ide-test-coverage.yml        # CI 测试 & 覆盖率门禁
```

---

## 🗺️ 文档导航

| 文档 | 位置 | 内容 |
| --- | --- | --- |
| **本文档** | [`README.md`](README.md) | 项目总览 / 快速开始 / 仓库结构 |
| 架构设计 | [`docs/architecture.md`](docs/architecture.md) | 分层原则 / 依赖图 / 域清单 / 约束 |
| 开发者指南 | [`docs/developer-guide.md`](docs/developer-guide.md) | 环境搭建 / 代码规范 / 调试 / 部署 / 核心模块 |
| 可视化规范 | [`docs/visualization-spec.md`](docs/visualization-spec.md) | 主题令牌 / 图表契约 / 性能 / 测试（§1-§12） |
| 功能演进 | [`docs/evolution-plan.md`](docs/evolution-plan.md) | 安全必修 / 质量攻坚 / Phase 路线图 |
| 回迁路线图 | [`archive/MIGRATION.md`](archive/MIGRATION.md) | 批次状态 / 回迁铁律 / 审计修复矩阵 |
| 协作服务端 | [`ide/collab-server/README.md`](ide/collab-server/README.md) | y-websocket 兼容服务端 / TTL / 持久化 |
| 组件库参考 | [`ide/components/visualization/README.md`](ide/components/visualization/README.md) | 图表 / 主题 / 校验 快速参考 |

---

## 📝 变更历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v2.0.0 | 2026-08-20 | 全面重构：项目总览精简为导航入口；可视化规范移至 docs/；新增架构文档与开发者指南 |
| v1.1.0 | 2026-08-20 | 完善 README：品牌顶图、徽章系统、文档架构可视化 |
| v1.0.0 | 2026-08-19 | 初始版本 |

---

<div align="center">

> 「***YanYuCloudCube***」· All things converge in cloud pivot

*© 2025-2026 YanYuCloudCube™ · YYC³ Family IDE Matrix · All Rights Reserved.*

</div>
