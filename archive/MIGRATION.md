# 单体回迁路线图 · MIGRATION.md

<!--
  file: archive/MIGRATION.md
  description: 2026-03 单体快照 → ide/ 生产线的渐进回迁计划与状态跟踪
  version: v1.0.0
  created: 2026-08-20
  status: active
  tags: [migration, roadmap, archive]
-->

## 背景

- `ide/` 为唯一生产线（分层工程：lib / components / services / stores，带 CI 与覆盖率门禁）
- `archive/ide-monolith-2026-03/` 为 2026-03 版功能大全集单体快照（405 文件 · 16.3 万行 ·
  基线提交 `ec0903c`，归档移动 `9cfe0a5`），**只读参考，不再直接修改**
- 对比分析与 2026 IDE 趋势调研结论：单体中的 MCP / 多 Agent / 上下文工程三块最贴近
  Agent-first + MCP/ACP 标准化 + Context Engine 三大趋势，列为第一批回迁

## 回迁铁律（每个模块必须全部满足）

1. **过 tsc**：新增/修改文件零类型错误（注意：ide/ 根面板存在预存坏引用，
   全仓 tsc 目前不绿，验收以「新文件零错误」为准，见「已知问题」）
2. **补 vitest**：模块带测试入库（归档有测试则移植适配，没有则新写）
3. **修 @ts-nocheck**：回迁文件不允许保留全文件级类型豁免
4. **修引号模板串**：单体代码存在 `'...${x}...'` 单引号包裹不插值 bug，回迁时改反引号
5. **依赖路径适配**：`./Logger` → `../logger`；类型统一从 `@/types` 或模块内取
6. **删根目录 deprecated 存根**：模块消费方全部切换到新路径后，删除根目录重导出存根

## 批次状态

### 第一批（2026 趋势 P0：MCP / 多 Agent / 上下文工程）

| 能力域 | 目标位置 | 状态 | 备注 |
| --- | --- | --- | --- |
| MCP 服务栈（Client/Tools/Prompts/Resources） | `ide/services/mcp/` | ✅ 已回迁 | 移植时移除 @ts-nocheck、修复 13 处引号模板串；新写 25 个测试用例；`readonly TTL + as any` 改为可变字段直赋 |
| MCP 配置面板 | `ide/components/model-settings/` | ✅ 早已迁移 | 单体中即已存在，无需动作 |
| 上下文压缩（Compressor/Strategy/Summarizer/Types） | `ide/llm/` | ✅ 已回迁 | 零外部依赖，移植归档版完整测试套件（移除 @ts-nocheck） |
| 上下文收集（ContextCollector） | `ide/llm/` | ✅ 已回迁 | 零依赖纯函数 |
| AgentOrchestrator + 多 Agent 调度 | 待定 | ⏸ 阻塞 | 依赖闭包见下节，需先建面板宿主抽象 |

**AgentOrchestrator 依赖闭包（阻塞原因）**：

```
AgentOrchestrator.tsx ──→ PanelManager（UI 宿主，未迁移）
                      └─→ ModelRegistry（依赖 stores/useModelStore）
MultiAgentPanel.tsx ───→ PanelManager + LLMService(811行) + useMemoryStore + i18n
AgentMarket.tsx ───────→ PanelManager（其余自包含）
useAgentOrchestrator ──→ AgentServiceAdapter + agent/types + useMemoryStore
useMultiAgentDispatch → LLMService + useMemoryStore + Logger
```

**解锁条件**：ide/ 先落地面板宿主（PanelHost）抽象 + 回迁 LLMService（建议列为 1.5 批），
随后 AgentMarket（最轻）→ 编排 hooks → 两个面板 依次迁入。

### 第二批（PluginSystem / 存储套件 / 安全套件）— 待办

- PluginSystem(748行) + 7 内置插件 + 插件市场
- 存储套件：StorageManager / IndexedDBAdapter / Backup / Migration / Encryption / Versioning
- 安全套件：Sanitizer / CsrfProtection / APIKeyVault / RateLimiter / EncryptionService
- 注意：`IndexedDBAdapter.optimized.ts`(812行) 与基础版(305行) 合并后回迁

### 第三批（需重写评估）— 待办

- CollabService(741行)：自研协作 → 评估改用 **Yjs / Loro**（2026 CRDT 生态主流）
- terminal-api v1/v2(512行) + XTerminal：**必须先行确定沙箱方案**
  （Firecracker microVM / gVisor / 托管 E2B，参考 2026-08 趋势调研），禁止裸迁
- MCP 客户端协议升级：`protocolVersion "2024-11-05"` → MCP **2026-07-28 规范**
  （无状态、可缓存、HTTP 头路由），同步评估 ACP 作为 Agent-编辑器协议

## .optimized.ts 双版本合并状态

| 文件 | 处理 |
| --- | --- |
| `PreviewModeController.optimized.ts` (375行) | ✅ **已合并** → `ide/lib/PreviewModeController.ts` v1.2.0：保留窗口式 smart 模式与类型安全，移植节流/批量队列/全定时器清理三特性，修复损坏的 @example 注释；测试契约同步更新 |
| `SnapshotManager.optimized.ts` (471 vs 697行) | ⏳ 快照模块回迁时合并（ide/lib/snapshot 已有独立实现，需三方对比） |
| `CodeValidator.optimized.ts` (474 vs 422行) | ⏳ 代码校验模块回迁时合并 |
| `IndexedDBAdapter.optimized.ts` (812 vs 305行) | ⏳ 第二批存储套件回迁时合并 |
| `SystemPromptBuilder.optimized.ts` (397 vs 336行) | ⏳ AI 提示词层回迁时合并 |

## 已知问题（回迁时顺带消除）

1. **ide/ 根面板预存坏引用（55 个 tsc 错误的主体）**：`APIKeyManagerPanel.tsx` 引用
   `./services/APIKeyVault`、`./stores/useConfirmStore`；`CollabPanel.tsx` 引用
   `./PanelManager`；`LayoutPresetsEnhanced`/`MultiInstancePanel`/`MonacoWrapper` 等
   存在 lucide 图标改名（CheckCircle2→CheckCircle 等）—— 均为单体模块/旧版依赖，
   对应模块回迁后消除。这也是 CI 只跑 vitest 不跑 tsc 的历史原因。
   （2026-08-20 基线：全仓 tsc 错误 94→55，其中回迁/修复部分见下）
2. **tsconfig**：已迁移为无 `baseUrl` 的相对 paths 写法（TS 5.6+ 弃用 baseUrl，
   7.0 移除），同时移除无效的 `ignoreDeprecations: "6.0"`（TS5103）。
3. **types/vitest.d.ts v2.0.0**：删除了伪造的 `declare module "vitest"` 兜底
   （其 Mock 类型用了不存在的 mockReturn/mockResolved 方法名，ambient 声明覆盖
   真实包类型，导致全部测试 mock 类型报错）；现仅保留 globals 注入并指向真实包。
   依赖安装后 `pnpm exec tsc --noEmit` 才能给出真实结果。
4. **覆盖率**：全库行覆盖 7.9%（回迁前），CI 门禁阈值目前仅对
   `services/agent/AgentSkills.ts` 生效；随模块回迁逐步扩大门禁范围。
   2026-08-20 回迁后：12 个测试文件 · 584 用例全绿。

## 变更历史

| 日期 | 事项 |
| --- | --- |
| 2026-08-20 | 保底提交 `ec0903c` → 归档移动 `9cfe0a5` → 第一批回迁（MCP 栈 + 上下文工程）→ PreviewModeController 双版本合并 v1.2.0 |
