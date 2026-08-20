# 架构设计

> 分层原则 / 依赖图 / 域清单 / 约束

## 分层原则

```
┌─────────────────────────────────────────────────────────────┐
│  components/  UI 层 —— 面板渲染、用户交互                      │
│               可引用 services/stores/hooks/lib/utils/types    │
├─────────────────────────────────────────────────────────────┤
│  services/    服务层 —— 外部集成、业务服务                     │
│               可引用 lib/utils/types，禁止引用 components      │
├─────────────────────────────────────────────────────────────┤
│  stores/      状态层 —— Zustand 全局状态                      │
│               可引用 lib/types，禁止引用 components/services   │
├─────────────────────────────────────────────────────────────┤
│  hooks/       逻辑层 —— 可复用 Hook                           │
│               可引用 stores/services/lib                     │
├─────────────────────────────────────────────────────────────┤
│  lib/         基础层 —— 编辑器引擎、核心算法                   │
│               零 UI 依赖；logger 为横切基础设施               │
├─────────────────────────────────────────────────────────────┤
│  llm/         上下文工程层 —— 压缩/摘要/收集                   │
│               零外部依赖（模块内自包含）                       │
├─────────────────────────────────────────────────────────────┤
│  utils/       工具层 —— 纯函数                                │
│               零业务依赖，只能引用 types                       │
├─────────────────────────────────────────────────────────────┤
│  types/       类型层 —— 零运行时依赖                           │
└─────────────────────────────────────────────────────────────┘
```

**依赖禁止反向引用**：
- ✅ `components/` → `services/` → `lib/`
- ❌ `lib/` → `components/`（绝对禁止）
- ❌ `utils/` → `services/`（utils 是最底层）

## services/ 域清单

| 域 | 位置 | 核心文件 | 职责 |
| --- | --- | --- | --- |
| **MCP** | `services/mcp/` | `MCPClient.ts` v1.2.0 | 2026-07-28 无状态规范：HTTP 头路由 / server/discover / ttlMs 缓存 |
| | | `MCPTools.ts` | 文件/Git/数据库/记忆 四类工具封装 |
| | | `MCPPrompts.ts` / `MCPResources.ts` | 提示词模板管理 / 资源缓存订阅 |
| **LLM** | `services/llm/` | `LLMService.ts` | Provider 管理 / Chat / SSE 流式 / Ollama 探测 |
| | | `AIDegradationService.ts` | 自动降级引擎（熔断+健康检测+自动恢复） |
| | | `RateLimiter.ts` | 令牌桶 / 滑动窗口 / 熔断器 |
| | | `providers.ts` | 服务商元数据唯一真相源 |
| **安全** | `services/security/` | `APIKeyVault.ts` | WebCrypto + IndexedDB 密钥保管 |
| | | `Sanitizer.ts` | DOMPurify 3.4 消毒 |
| | | `CsrfProtection.ts` | 常数时间比较双提交 |
| | | `EncryptionService.ts` | WebCrypto AES-GCM |
| **存储** | `services/storage/` | `IndexedDBAdapter.ts` | idb 适配 + 缓存 + 性能指标（双版本合并） |
| | | `StorageManager.ts` | 配额监控 + React Hook |
| | | `BackupService.ts` / `VersioningService.ts` | 备份导出 / 版本管理 |
| | | `ThreeWayMerge.ts` | Myers Diff 三方合并 |
| | | `CloudSyncService.ts` | 云同步（含冲突解决） |
| | | `DataExporter/Importer` / `MigrationService` | 数据迁移 |
| | | `StorageCleanup.ts` / `StorageMonitor.ts` | 存储清理 / 监控 |
| **插件** | `services/plugins/` | `PluginSystem.ts` | PluginManager + 事件总线 + 命令注册 + 市场 |
| | | `*Plugin.ts` ×7 | 内置插件（AI 助手/代码片段/统计/文件增强/Git/快修/主题） |
| **协作** | `services/collab/` | `CollabService.ts` v2.0.0 | Yjs 胶水版（y-websocket/y-indexeddb/Awareness/y-monaco） |
| | | `config.ts` | 服务端地址配置化（env → 显式覆盖优先级） |
| **终端** | `services/terminal/` | `TerminalService.ts` | 策略闸门管线：准入→配额→供应商→超时→审计 |
| | | `policy.ts` | shell 元字符硬闸门 / 白名单 / 会话配额 / 环形审计 |
| | | `providers/` | E2BProvider / CloudflareProvider（SDK 注入）/ DryRunProvider |
| | | `createTerminalService.ts` | 异步工厂：env 驱动 / 优雅降级 DryRun |
| **Agent** | `services/agent/` | `AgentSkills.ts` | 技能注册与蓝图数据 |

## components/ 域清单

| 域 | 位置 | 核心文件 | 职责 |
| --- | --- | --- | --- |
| **面板宿主** | `components/panel-host/` | `PanelHeader.tsx` | 解耦标题栏（无 dnd/pin/floating 耦合） |
| | | `PanelManagerContext.tsx` | 布局树状态 + 编辑操作 + 浮动窗口 + Pin |
| | | `layout-ops.ts` | 纯函数布局编辑（split/remove/insert/swap/resize） |
| | | `PanelShell.tsx` | 递归布局渲染器 + DnD + 分隔条 + 浮动窗口层 |
| **工作台** | `components/workbench/` | `IdeWorkbench.tsx` | Monaco × PanelShell × 真实面板组装 |
| **Agent** | `components/agent/` | `AgentMarket.tsx` | Agent 市场面板 |
| | | `AgentOrchestrator.tsx` | 可视化编排面板 |
| | | `MultiAgentPanel.tsx` | 四阶段流水线面板 |
| | | `ModelRegistry.tsx` | Provider + useModelRegistry 上下文 |
| **终端** | `components/terminal/` | `TerminalPanel.tsx` | REPL 驱动（行缓冲/Ctrl+C/退出码/供应商徽章） |
| | | `XTerminal.tsx` | xterm 封装（FitAddon/WebLinks/Search/Unicode11） |
| **可视化** | `components/visualization/` | `index.ts` v2.0 | 统一出口：主题令牌+Zod Schema+LTTB+图表工具 |
| | | `theme/tokens.ts` | Cyberpunk-88 + Sunrise 双主题设计令牌 |
| **其他** | `components/model-settings/` 等 | — | 模型设置 / 插件市场 / 快照 Diff |

## stores/ 域清单

| Store | 位置 | 职责 |
| --- | --- | --- |
| `useMemoryStore` | `stores/` | 持久记忆（idb + TF-IDF 语义检索） |
| `usePreviewStore` | `stores/` | 预览状态（refresh/URL/scrollSync/notifyFileChange） |
| `useFileStoreZustand` | `stores/` | 文件树管理 |
| `useThemeStore` + `CustomThemeStore` | `stores/` | 主题切换 + 自定义主题 |
| `useEditorRegistry` / `useScrollSyncStore` | `stores/` | 编辑器注册 / 滚动同步 |
| `useToastStore` / `useConfirmStore` | `stores/` | Toast / 确认对话框 |
| `useWindow/Workspace/Session/IPCStore` | `stores/` | 多实例窗口/工作区/会话/IPC |
| `useModelStoreZustand` / `useProxyStoreZustand` | `stores/` | 模型选择 / 代理配置 |

## 依赖图（关键边）

```
components/workbench ──→ components/panel-host ──→ types (LayoutNode)
       │                              │
       ↓                              ↓
components/terminal ──→ services/terminal ──→ providers (E2B/CF/DryRun)
       │
       ↓
components/agent ──→ services/llm (chatCompletion/降级)
       │
       ↓
services/collab ──→ yjs / y-websocket / y-indexeddb / y-monaco
       │
       ↓
collab-server (ws + y-protocols + lib0)
```

## 约束与铁律

1. **新文件 tsc 零错误** —— `pnpm exec tsc --noEmit` 不引入新 error
2. **补 vitest** —— 模块带测试入库
3. **禁 `@ts-nocheck`** —— 全仓源码零残留
4. **禁单引号 `${}` 模板串** —— 日志输出会打字面 `${...}` 而非插值
5. **依赖路径就近** —— `from "../logger"` 而非 `from "../services/logger"`
6. **零硬依赖可选 SDK** —— e2b/@cloudflare/sandbox 仅经 `import(/* @vite-ignore */)` 动态加载

## 已知值环（文档化，ESM 安全）

- `services/llm/LLMService.ts` ↔ `AIDegradationService.ts`
  - LLMService 值级导入 `getAIDegradationService`
  - AIDegradation 值级导入 `chatCompletion` 等 5 符号
  - ESM 活绑定下运行时安全（双方仅在函数体内互调）

## 已清理项（不再存在）

- ~~根目录 deprecated 重导出存根~~（22 个死文件已删）
- ~~`services/logger.ts`~~（真身下沉至 `lib/logger.ts`，services/ 侧保留转发）
- ~~`@ts-nocheck` 指令~~（8 个全移除）
- ~~单引号 `${}` 不插值 bug~~（全仓清零）
