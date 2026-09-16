<!--
  file: docs/README.md
  description: docs/ 文档中心索引
  author: YanYuCloudCube Team <admin@0379.email>
  version: v3.1.0
  created: 2026-08-20
  updated: 2026-09-16
  status: active
  tags: [docs,index]
-->

# docs/ · 文档中心

本目录存放项目文档，不放源代码。

## 文档索引

### 主题文档 | Topic Docs

| 文档 | 内容 | 目标读者 |
| --- | --- | --- |
| [`architecture.md`](architecture.md) | 分层原则 / 依赖图 / 域清单 / 构建配置 / 约束 | 架构师 / 全体 |
| [`developer-guide.md`](developer-guide.md) | 环境搭建 / 代码规范 / **10 个核心模块** / 可观测性 / 测试 / 部署 | 开发者 |
| [`visualization-spec.md`](visualization-spec.md) | 主题令牌 / 图表契约 / 性能 / 测试（§1-§12） | 前端工程师 / 设计师 |
| [`evolution-plan.md`](evolution-plan.md) | Phase 1-3 ✅ 全部完成 / 能力矩阵 / 性能预算 / 下一步建议 | 技术负责人 |

### 工程规范 | Engineering Standards

| 文档 | 内容 | 目标读者 |
| --- | --- | --- |
| [`CICD.md`](CICD.md) | 流水线触发 / Job 链 / 门禁标准 / 供应链加固 / 制品 / 本地等价命令 | 开发者 / DevOps |
| [`LABELS.md`](LABELS.md) | 类型 / 优先级 / 状态 / 模块标签与使用规则 | Issue / PR 作者 |
| [`RELEASE.md`](RELEASE.md) | 语义化版本 / 前置检查单 / 发布流程 / 发布后动作 / 回滚 | 维护者 |
| [`STYLE-GUIDE.md`](STYLE-GUIDE.md) | 双语规范 / Markdown 结构 / Mermaid 可视化 / 徽章规则 | 文档贡献者 |

## 文档更新日志

| 日期 | 变更 |
| --- | --- |
| 2026-09-16 | v3.1：补全工程规范文档——新增 `CICD.md` / `LABELS.md` / `RELEASE.md` / `STYLE-GUIDE.md`，并新增仓库治理文档（`CONTRIBUTING.md` / `SECURITY.md` / `CODE_OF_CONDUCT.md` / `CHANGELOG.md` / `LICENSE`） |
| 2026-08-28 | v3.0：Phase 1-3 全部完成后同步更新——新增多文件编辑/Sandpack/AI补全/代理适配/口令派生/审计持久化/Electron 脚手架等 10 个新模块文档 |
| 2026-08-20 | v2.0：文档架构重构（README 精简 + docs/ 4 文件） |

## 相关文档（仓库其他位置）

| 文档 | 位置 | 内容 |
| --- | --- | --- |
| 项目总览 | [`../README.md`](../README.md) | 快速开始 / 仓库结构 / 核心能力域 |
| 贡献指南 | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | 环境 / 分支 / 提交 / 质量门禁 / PR 检查单 |
| 安全策略 | [`../SECURITY.md`](../SECURITY.md) | 漏洞报告流程 / 安全编码基线 |
| 行为准则 | [`../CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) | 社区公约与执行流程 |
| 更新日志 | [`../CHANGELOG.md`](../CHANGELOG.md) | Keep a Changelog + SemVer |
| 回迁路线图 | [`../archive/MIGRATION.md`](../archive/MIGRATION.md) | 批次状态 / 回迁铁律 / 审计修复矩阵 |
| 协作服务端 | [`../ide/collab-server/README.md`](../ide/collab-server/README.md) | y-websocket 兼容 / TTL / 持久化 / 鉴权 |
| 组件库参考 | [`../ide/components/visualization/README.md`](../ide/components/visualization/README.md) | 图表 / 主题 / 校验 快速参考 |

> **归档说明**：2026-03 版 IDE 单体快照（405 个源文件）已于 2026-08-20
> 迁移至 [`../archive/ide-monolith-2026-03/`](../archive/ide-monolith-2026-03/)。
