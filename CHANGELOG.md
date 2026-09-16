<!--
  file: CHANGELOG.md
  description: YYC³ Family IDE Matrix · 更新日志（Keep a Changelog + SemVer）
  author: YanYuCloudCube Team <admin@0379.email>
  version: v1.0.0
  created: 2026-09-16
  updated: 2026-09-16
  status: active
  tags: [changelog,release,history]
-->

# 更新日志 | Changelog

本项目所有重要变更记录于此。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本遵循 [SemVer 2.0.0](https://semver.org/lang/zh-CN/)。
All notable changes are documented here. Based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer 2.0.0](https://semver.org/).

> 变更提交 changelog submissions: <dev@0379.email> · 发布流程见 [`docs/RELEASE.md`](docs/RELEASE.md)

---

## [Unreleased]

### 计划 Planned

- 首屏 gzip 从 253KB 降至 < 200KB（性能预算见 [`docs/developer-guide.md`](docs/developer-guide.md) §8）
- 面板宿主布局树持久化 + 多工作区切换
- 协作服务端水平扩展（房间分片 + Redis 广播）

---

## [3.0.0] - 2026-08-28

> Phase 1-3 全部完成：生产闭环 → 安全增强 → 功能增强。

### Added 新增

- **多文件编辑**：`FileStore`（多文件状态）+ `FileExplorer`（文件树 / 搜索 / 新建删除）+ `EditorTabs`（Tab 切换 / 语言色点）
- **实时预览**：`SandpackPreview.tsx` 接入 Sandpack 热更新，自动识别 `react-ts` / `static` 模板
- **AI 补全**：`services/AICompletionService.ts` Monaco 内联补全，经代理适配层调用
- **桌面端**：`electron/` 脚手架（IPC 白名单 + `contextIsolation`）、`pnpm electron:dev` / `electron:build`
- **代理适配层**：`services/llm/proxyAdapter.ts`（代理优先 → 直发回退，密钥服务端注入）
- **可观测性接线**：`src/main.tsx` 全局 ErrorBoundary + `ErrorReportingService` 真发送
- **协作鉴权与持久化**：`collab-server` 增加鉴权 / TTL / 速率限制 / 持久化
- **编辑器基础设施**：`lib/MonacoWorkerManager.ts`、`PreviewModeController`、`ZoomController`
- **文档体系**：`docs/` 四篇（架构 / 开发者指南 / 可视化规范 / 演进方案）+ 可视化模块 README

### Changed 变更

- 主包瘦身：Monaco / Sandpack 改为 `React.lazy` 分包加载
- 构建配置：`vite.config.ts` 关闭生产 sourcemap + 手动分包
- 文档架构重构为「README 导航入口 + `docs/` 主题文档」

### Fixed 修复

- 修复 Dependabot 报告的 9 项安全告警（依赖升级 + overrides 收敛 `vite` / `esbuild`）

### Security 安全

- **Phase 1**：CI 增加 `pnpm audit --prod` 门禁、Actions 全部 commit SHA 固定、CSP 响应头
- **Phase 2**：`APIKeyVault.unlockWithPassphrase`（PBKDF2 310K → 非导出 CryptoKey）、供应链门禁（CodeQL + Dependabot）、终端审计持久化（IndexedDB append-only）
- **Phase 3**：终端与预览链路接入统一策略闸门

---

## [2.0.0] - 2026-08-20

### Changed 变更

- 文档架构重构：根 README 精简为「总览 + 导航入口」，内容下沉至 `docs/` 四篇
- 2026-03 版 IDE 单体快照迁移至 [`archive/ide-monolith-2026-03/`](archive/ide-monolith-2026-03/)，并附 [回迁路线图](archive/MIGRATION.md)

---

## [1.0.0] - 2026-08-19

### Added 新增

- **工作台基座**：Monaco 编辑器封装（Worker 管线）、面板宿主（布局树 / DnD / 浮动窗口 / Pin）
- **MCP 服务栈**：`services/mcp/` 客户端（2026-07-28 无状态规范，HTTP 头路由 / `server/discover` / `ttlMs` 缓存）+ 工具 / 提示词 / 资源管理
- **LLM 调用层**：Provider 管理 + SSE 流式 + 降级引擎 + 令牌桶限流 + 熔断器
- **安全套件**：`APIKeyVault` / `Sanitizer` / `CsrfProtection` / `EncryptionService`
- **存储全套**：IndexedDB 适配 + 备份 / 云同步 / 导入导出 / 迁移 / 版本化 / 三路合并
- **Snapshot 体系**：Myers Diff + SnapshotDiffEngine + 批量应用
- **插件系统**：`services/plugins/` 插件注册与生命周期 + 7 个内置插件
- **Agent 能力**：`services/agent/` 技能与蓝图数据、多 Agent 调度 hook
- **可视化体系**：主题令牌（Cyberpunk-88 / Sunrise 双主题）+ Recharts 图表 + Zod 契约 + LTTB 降采样
- **质量门禁**：Vitest + v8 覆盖率、CI 测试矩阵（2 OS × 3 Node）

---

## 版本语义 | Versioning Semantics

| 变更类型 Change | 版本位 Bump |
| --- | --- |
| 破坏性变更 Breaking | MAJOR |
| 新功能 / 新模块 Feature | MINOR |
| 缺陷修复 / 文档笔误 Fix / Typo | PATCH |

> 发布由 `v*.*.*` 标签触发（见 [`docs/RELEASE.md`](docs/RELEASE.md)）；条目在合并时由维护者汇总。
> Releases are tag-driven; entries are aggregated by maintainers at merge time.

[Unreleased]: https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/releases/tag/v3.0.0
[2.0.0]: https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/releases/tag/v2.0.0
[1.0.0]: https://github.com/YYC-Cube/YYC3-Family-IDE-Matrix/releases/tag/v1.0.0

---

<div align="center">

**© 2025-2026 YanYuCloudCube™** · YYC³ Family IDE Matrix

</div>
