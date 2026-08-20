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
| MCP 服务栈（Client/Tools/Prompts/Resources） | `ide/services/mcp/` | ✅ 已回迁 | 移植时移除 @ts-nocheck、修复 13 处引号模板串；新写测试用例；`readonly TTL + as any` 改为可变字段直赋 |
| **MCP 客户端升级 2026-07-28 规范** | `ide/services/mcp/MCPClient.ts` | ✅ v1.2.0 | 无状态（废除 initialize 握手/Mcp-Session-Id）、HTTP 头路由（MCP-Protocol-Version/Mcp-Method/Mcp-Name）、列表响应 ttlMs+cacheScope 缓存提示、protocolVersion 可配置回退。来源：blog.modelcontextprotocol.io/posts/2026-07-28 |
| MCP 配置面板 | `ide/components/model-settings/` | ✅ 早已迁移 | 单体中即已存在，无需动作 |
| 上下文压缩（Compressor/Strategy/Summarizer/Types） | `ide/llm/` | ✅ 已回迁 | 零外部依赖，移植归档版完整测试套件（移除 @ts-nocheck） |
| 上下文收集（ContextCollector） | `ide/llm/` | ✅ 已回迁 | 零依赖纯函数 |
| AgentOrchestrator + 多 Agent 调度 | `ide/components/agent/` + `ide/hooks/` | ✅ **已回迁** | Agent 批三步全部完成（2026-08-20 晚）：① useMemoryStore（idb 持久化+语义检索，新增依赖 idb@8.0.3）② useMultiAgentDispatch 四阶段流水线 ③ AgentOrchestrator(422行)+MultiAgentPanel(1233行)+ModelRegistry(918行)+i18n(1031行) |

### 1.5 批（2026-08-20 完成：解锁 Agent 编排的前置依赖）

| 能力域 | 目标位置 | 状态 | 备注 |
| --- | --- | --- | --- |
| LLMService（811行）+ AIDegradationService（532行）+ RateLimiter（501行）+ providers | `ide/services/llm/` | ✅ 已回迁 | 共享类型抽至 types.ts 缩小值级循环环面；修复 7 处引号模板串 + 2 个真 bug（见下） |
| 面板宿主抽象 | `ide/components/panel-host/` | ✅ 新建 | PanelHeader 解耦最小实现（无 dnd/pin/floating）+ --ide-* 令牌 CSS |
| AgentMarket（383行） | `ide/components/agent/` | ✅ 已回迁 | 验证面板宿主可用；自带冒烟测试 |

**1.5 批修复的单体真 bug**：
1. `AIDegradationService.selectModel`：models.length===0 提前返回 null，而 ollama
   预设列表为空 → 降级链中的 ollama 永远选不出模型被跳过。改为先查活跃模型再回退。
2. `providers.ts` ollama baseURL 含 `/api/chat` 与 `getChatEndpoint` 后缀叠加成
   双重路径。baseURL 改为服务根地址。

**AgentOrchestrator 批次（更新后依赖状态）**：

```
PanelHeader ──────────── ✅ 已由 components/panel-host 提供
LLMService(811行) ────── ✅ 已由 services/llm 提供
useMemoryStore(367行) ── ⏳ 依赖 zustand+idb（idb 需加依赖或去 idb 化）
ModelRegistry ────────── ⏳ 依赖 stores/useModelStoreZustand（现在类型可从 services/llm 取）
i18n ──────────────────── ⏳ MultiAgentPanel 专用
```

**下一步（Agent 批已完成，2026-08-20 晚）**：三小步全部落地——useMemoryStore →
`stores/`（idb 依赖已加入 package.json）；useMultiAgentDispatch → `hooks/`；
AgentOrchestrator/MultiAgentPanel/ModelRegistry/i18n → `components/agent/` +
`i18n/`。编排器需 ModelRegistryProvider 包裹（useModelRegistry 上下文契约，
测试已覆盖）。**剩余方向：第二批 PluginSystem/存储/安全套件**（顺带消除
APIKeyVault/useConfirmStore 等根面板坏引用），第三批 CollabService(Yjs/Loro
重写评估)与 terminal-api(沙箱先行)。

### 第二批（PluginSystem / 存储套件 / 安全套件）— ✅ 已完成（2026-08-20 深夜）

| 能力域 | 目标位置 | 状态 | 备注 |
| --- | --- | --- | --- |
| 安全套件 | `ide/services/security/` | ✅ | APIKeyVault/Sanitizer/CsrfProtection/EncryptionService + 148 用例；新依赖 dompurify |
| useConfirmStore | `ide/stores/` | ✅ | APIKeyManagerPanel 5 个预存 tsc 错误随之清零 |
| 存储套件 | `ide/services/storage/` | ✅ | IndexedDBAdapter 双版本合并（optimized 基座+补回 getDB）+ StorageManager/Backup/Versioning/ThreeWayMerge + 212 用例 |
| PluginSystem + 7 插件 + 市场 | `ide/services/plugins/` + `components/plugins/` | ✅ | 淘汰滞后 PluginContext；修复 bookmarks/context 命名炸弹与 4 处引号 bug |
| StorageCleanup / StorageMonitor | 未迁 | ⏳ | 422+421 行，随存储面板需求再迁 |
| CloudSyncService / DataExporter / DataImporter / MigrationService | 未迁 | ⏳ | 云同步相关，需后端配套 |

### 第三批（重写评估）— 选型已定（2026-08-20 调研，见下），实施待排期

**决策一：CollabService 重写 = Yjs 胶水化（推荐，高置信）**

关键发现：归档 CollabService（741 行）本就是 Yjs 基座，问题是自研了生态免费提供的
东西。重写路径（预计 741 → ~150 行胶水）：
1. 删自研 sync-step-1/2 WS 协议与 ThreeWayMerge 依赖 → 换 **y-websocket** provider
2. 光标/在线状态 → **Y.Awareness**
3. 离线队列 → **y-indexeddb**
4. 编辑器绑定 → **y-monaco**（官方维护，npm 0.1.6，Liveblocks 生产采用）
- 不选 Loro/Automerge 的原因：性能虽强但无官方 Monaco 绑定（loro-monaco 为
  爱好级），需自写绑定，收益不抵风险。Yjs 纯 TS 无 WASM、包最小。

**决策二：终端沙箱 = 托管 API 起步 → 中期 Daytona 自托管降本（中高置信）**

- WebContainers **不能**替代服务端沙箱：仅 Node.js、生产需商业授权、依赖
  SharedArrayBuffer 跨域隔离头、Safari 受限——定位为零成本 dev-server 预览的补充
- MVP（0-3 月）：terminal-api 接 E2B（~$0.05/vCPU·h）或 Cloudflare Sandbox
  （2026-04 GA）；命令白名单 + 会话超时配额 + 审计日志；预算 $50-150/月
- 生产（3-9 月）：低风险命令迁 Daytona 单 VPS 自托管（$6-12/月），高风险留托管
  microVM；保持双供应商 SDK 适配层
- **明确不做**：自建 Firecracker/gVisor 集群（小团队运维硬门槛）
- 风险：Daytona Docker 隔离弱于 microVM（勿跑恶意向命令）；托管 API 供应商锁定

## .optimized.ts 双版本合并状态

| 文件 | 处理 |
| --- | --- |
| `PreviewModeController.optimized.ts` (375行) | ✅ **已合并** → `ide/lib/PreviewModeController.ts` v1.2.0：保留窗口式 smart 模式与类型安全，移植节流/批量队列/全定时器清理三特性，修复损坏的 @example 注释；测试契约同步更新 |
| `SnapshotManager.optimized.ts` (471 vs 697行) | ⏳ 快照模块回迁时合并（ide/lib/snapshot 已有独立实现，需三方对比） |
| `CodeValidator.optimized.ts` (474 vs 422行) | ⏳ 代码校验模块回迁时合并 |
| `IndexedDBAdapter.optimized.ts` (812 vs 305行) | ⏳ 第二批存储套件回迁时合并 |
| `SystemPromptBuilder.optimized.ts` (397 vs 336行) | ⏳ AI 提示词层回迁时合并 |

## 已知问题（回迁时顺带消除）

1. **ide/ 根面板预存坏引用（2026-08-20 晚基线：26 个 tsc 错误）**：
   `APIKeyManagerPanel.tsx` 引用 `./services/APIKeyVault`、`./stores/useConfirmStore`；
   `CollabPanel.tsx` 引用 `./PanelManager`；`MonacoWrapper.tsx` 8 个（react-dnd 等）
   —— 均为未迁入的单体模块，对应模块回迁后消除。这也是 CI 只跑 vitest 不跑
   tsc 的历史原因。（错误数变化：初始 94 → 删假 vitest 垫片后 55 → 删假
   lucide 垫片后 26）
2. **假类型垫片清理记录**：`types/vitest.d.ts`（伪造 Mock API，已重写 v2.0.0
   仅留 globals）与 `types/lucide-react.d.ts`（手工图标清单缺 Store/Code2/
   CheckCircle2/Edit3/XCircle 等，已删除）。两者均创建于 node_modules 为空的
   时期，ambient `declare module` 会覆盖真实包类型 —— 教训：**依赖装好后必须
   删除此类垫片，否则类型检查给出的是假象**。
3. **tsconfig**：已迁移为无 `baseUrl` 的相对 paths 写法（TS 5.6+ 弃用 baseUrl，
   7.0 移除）。
4. **覆盖率**：CI 门禁阈值目前仅对 `services/agent/AgentSkills.ts` 生效；
   随模块回迁逐步扩大门禁范围。2026-08-20 晚：16 个测试文件 · 645 用例全绿
   （当日新增 MCP 33 + 上下文 26 + LLM 53 + Agent 面板 6）。

## 变更历史

| 日期 | 事项 |
| --- | --- |
| 2026-08-20 上午 | 保底提交 `ec0903c` → 归档移动 `9cfe0a5` → 第一批回迁（MCP 栈 + 上下文工程）→ PreviewModeController 双版本合并 v1.2.0 → 删假 vitest 垫片 |
| 2026-08-20 下午 | 1.5 批：LLMService/降级引擎/限流器 → services/llm/（修复 selectModel 与 ollama baseURL 真 bug）→ 面板宿主 panel-host + AgentMarket 回迁 → MCP 客户端升级 2026-07-28 规范 v1.2.0 → 删假 lucide 垫片（tsc 错误 55→26）|
| 2026-08-20 晚 | Agent 编排批次收官：useMemoryStore（+idb 依赖）→ useMultiAgentDispatch → AgentOrchestrator/MultiAgentPanel/ModelRegistry/i18n。累计 668 用例全绿 |
| 2026-08-20 深夜 | 第二批收官：安全/存储/插件三套件 + useConfirmStore（881 用例全绿，全仓 tsc 94→19）；第三批选型定案：Collab=Yjs 胶木化（y-websocket/Awareness/y-indexeddb/y-monaco），沙箱=托管 API 起步→Daytona 降本，WebContainers 定位预览补充 |
