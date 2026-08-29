# 架构设计

> 分层原则 / 依赖图 / 域清单 / 约束 · v2.0（Phase 1-3 完成后更新）

## 分层原则

```
┌─────────────────────────────────────────────────────────────────┐
│  src/main.tsx      入口 — 可观测性接线 + ErrorBoundary + 挂载     │
├─────────────────────────────────────────────────────────────────┤
│  electron/         桌面壳 — IPC 白名单 + contextIsolation        │
├─────────────────────────────────────────────────────────────────┤
│  components/       UI 层 —— 8 域                                  │
│  ├─ workbench/     工作台（多文件编辑 + Sandpack + Tab + 组装）   │
│  ├─ panel-host/    面板宿主（布局/DnD/浮动/上下文）                │
│  ├─ agent/         Agent 面板（市场/编排器/流水线/注册表）          │
│  ├─ terminal/      终端面板（REPL/沙箱消费端/供应商徽章）           │
│  ├─ visualization/ 可视化（主题令牌/图表/Zod/LTTB）                │
│  ├─ model-settings/ 模型设置                                       │
│  ├─ plugins/       插件市场                                        │
│  └─ snapshot/      快照 Diff                                       │
├─────────────────────────────────────────────────────────────────┤
│  services/         服务层 —— 9 域                                  │
│  ├─ mcp/           MCP 客户端（2026-07-28 规范 v1.2.0）            │
│  ├─ llm/           LLM 调用 + 降级 + 限流 + ★代理适配              │
│  ├─ security/      安全套件 + ★口令派生                            │
│  ├─ storage/       存储全套                                        │
│  ├─ plugins/       插件系统                                        │
│  ├─ collab/        Yjs 协作 + 配置化                               │
│  ├─ terminal/      沙箱终端 + ★审计持久化                          │
│  ├─ agent/         Agent 技能                                      │
│  └─ (平铺)         ErrorReporting / AICompletion / ProxyService    │
├─────────────────────────────────────────────────────────────────┤
│  llm/              上下文工程（压缩/摘要/收集）                     │
├─────────────────────────────────────────────────────────────────┤
│  stores/           状态层 —— 14 Store（含 FileStore 多文件）       │
├─────────────────────────────────────────────────────────────────┤
│  hooks/            Hook 层（多Agent调度/主题令牌等）                │
├─────────────────────────────────────────────────────────────────┤
│  lib/              基础层（Monaco Worker/预览控制器/快照/logger）   │
├─────────────────────────────────────────────────────────────────┤
│  i18n/             国际化                                          │
├─────────────────────────────────────────────────────────────────┤
│  collab-server/    协作服务端（TTL+持久化+鉴权+速率限制）           │
├─────────────────────────────────────────────────────────────────┤
│  utils/            工具层（clipboard/xterm-theme）                │
├─────────────────────────────────────────────────────────────────┤
│  types/constants/  类型与常量                                      │
└─────────────────────────────────────────────────────────────────┘
```

**依赖方向**：`components/` → `services/` → `lib/` → `utils/` → `types/`
**禁止反向**：`lib/` ✗→ `components/`；`utils/` ✗→ `services/`

---

## services/ 域清单

### MCP（`services/mcp/`）
| 文件 | 说明 |
| --- | --- |
| `MCPClient.ts` v1.2.0 | 2026-07-28 无状态规范：HTTP 头路由 / `server/discover` / `ttlMs` 缓存 |
| `MCPTools.ts` | 文件 / Git / 数据库 / 记忆 四类工具封装 |
| `MCPPrompts.ts` | 提示词模板管理（8 内置模板 + 导入导出） |
| `MCPResources.ts` | 资源缓存订阅（5 分钟 TTL） |

### LLM（`services/llm/`）
| 文件 | 说明 |
| --- | --- |
| `LLMService.ts` | Provider 管理 / Chat / SSE 流式 / Ollama 探测 / 密钥管理 |
| `proxyAdapter.ts` ★P2 | 智能调用：代理优先 → 直发回退（密钥服务端注入）+ `PROXY_SERVER_NODE` |
| `AIDegradationService.ts` | 自动降级引擎（熔断 + 健康检测 + 自动恢复） |
| `RateLimiter.ts` | 令牌桶 / 滑动窗口 / 熔断器 |
| `providers.ts` | 服务商元数据唯一真相源 |

### 安全（`services/security/`）
| 文件 | 说明 |
| --- | --- |
| `APIKeyVault.ts` | WebCrypto AES-GCM 密钥保管 + ★P2 `unlockWithPassphrase`（PBKDF2 310K → 非导出 CryptoKey） |
| `Sanitizer.ts` | DOMPurify 3.4 消毒 |
| `CsrfProtection.ts` | 常数时间比较双提交 |
| `EncryptionService.ts` | WebCrypto AES-GCM |

### 终端（`services/terminal/`）
| 文件 | 说明 |
| --- | --- |
| `TerminalService.ts` | 策略闸门管线：元字符→白名单→配额→超时→供应商→审计 |
| `policy.ts` | ★P2 审计双写：内存环形 + IndexedDB append-only（`getPersistentAuditLog`） |
| `createTerminalService.ts` | 异步工厂：env 驱动 / 优雅降级 DryRun |
| `providers/` | E2B / Cloudflare（SDK 注入）/ DryRun |

### 协作（`services/collab/`）
| 文件 | 说明 |
| --- | --- |
| `CollabService.ts` v2.0.0 | Yjs 胶水版（y-websocket / y-indexeddb / Awareness / y-monaco） |
| `config.ts` | 服务端地址配置化（env → 显式覆盖优先级） |

### 其他服务
| 位置 | 说明 |
| --- | --- |
| `services/ErrorReportingService.ts` | 全局异常捕获 + ★P1 Sentry 真发送 + destroy 移除监听 |
| `services/AICompletionService.ts` | Monaco 内联补全 + ★P3 接 proxyAdapter |
| `ProxyService.ts` | 代理配置 + 转发 + 健康检查 + CF Worker 模板 |

---

## components/ 域清单

### 工作台（`components/workbench/`）
| 文件 | 说明 |
| --- | --- |
| `IdeWorkbench.tsx` | 组装入口：Monaco × PanelShell × 真实面板 × 预设工具栏 |
| `FileExplorer.tsx` ★P3 | 文件树（递归渲染 / 搜索 / 新建删除 / 类型图标） |
| `EditorTabs.tsx` ★P3 | 多文件 Tab 切换 / 关闭 / 语言色点 |
| `__tests__/` | 5 用例：布局 / 预设 / lazy / 浮出 / collab 联通 |

### 面板宿主（`components/panel-host/`）
| 文件 | 说明 |
| --- | --- |
| `PanelHeader.tsx` | 解耦标题栏 |
| `PanelManagerContext.tsx` | 布局树 + 编辑操作 + 浮动窗口 + Pin |
| `layout-ops.ts` | 纯函数布局编辑 |
| `PanelShell.tsx` | 递归渲染 + DnD + 分隔条 + 浮动层 |

### 终端（`components/terminal/`）
| 文件 | 说明 |
| --- | --- |
| `TerminalPanel.tsx` | REPL + `SandboxedTerminalPanel`（env 热切 E2B/CF）+ 供应商徽章 |
| `XTerminal.tsx` | xterm 封装（FitAddon / WebLinks / Search / Unicode11） |

---

## stores/ 域清单

| Store | 说明 |
| --- | --- |
| `useFileStoreZustand` | ★P3 多文件管理（CRUD / 打开关闭 / 最近列表） |
| `useMemoryStore` | 持久记忆（idb + TF-IDF 语义检索） |
| `usePreviewStore` | 预览状态（含 scrollSync / notifyFileChange） |
| `useThemeStore` + `CustomThemeStore` | 主题切换 + 自定义主题 |
| 其余 10 Store | 编辑器注册 / 滚动同步 / Toast / 确认 / 多实例窗口/工作区/会话/IPC / 模型 / 代理 |

---

## 根目录组件（扁平，对齐面板 import 路径）

| 文件 | 说明 |
| --- | --- |
| `MonacoWrapper.tsx` | Monaco 编辑器封装（worker / 主题 / AI 补全注册） |
| `SandpackPreview.tsx` v2.0.0 | ★P3 Sandpack 实时预览（FileStore → 热更新） |
| `ProxyService.ts` | 代理配置 + 转发 + CF Worker 模板 |
| `CollabPanel.tsx` | 协作面板（可选注入 CollabService） |
| `APIKeyManagerPanel.tsx` | API 密钥管理面板 |
| 其余 | LazyMonaco / LazySandpack / fileData / LayoutPresetsEnhanced / MultiInstancePanel |

---

## electron/（桌面端脚手架）

| 文件 | 说明 |
| --- | --- |
| `main.js` | 主进程：BrowserWindow + 隐藏标题栏 + IPC 白名单文件系统 |
| `preload.js` | contextBridge 安全桥接（仅 readFile / writeFile / platform） |

**安全模型**：`contextIsolation: true` + `sandbox: true` + `nodeIntegration: false` + 文件系统仅白名单目录

---

## 依赖图（关键边）

```
src/main.tsx ──→ components/workbench/IdeWorkbench
                        │
         ┌──────────────┼──────────────┐
         ↓              ↓              ↓
   FileExplorer    MonacoPanel    SandpackPreview
         │              │              │
         ↓              ↓              ↓
   stores/useFileStore  MonacoWrapper  @codesandbox/sandpack-react
         │              │
         │              ↓
         │      services/AICompletionService ──→ services/llm/proxyAdapter
         │                                            │
         │                              ┌─────────────┤
         │                              ↓             ↓
         │                        ProxyService    LLMService
         │                        (代理转发)      (直发回退)
         │
         ↓
   PanelShell ──→ PanelManagerContext ──→ layout-ops
         │
         ↓
   SandboxedTerminalPanel ──→ services/terminal
                                  │
                                  ↓
                            providers (E2B/CF/DryRun)

   services/collab ──→ yjs / y-websocket / y-indexeddb / y-monaco
         │
         ↓
   collab-server (ws + y-protocols + lib0)
         │
         ↓
   [Origin 白名单 → Token → 速率限制 → 房间配额 → maxPayload]
```

---

## 构建配置

### vite.config.ts（P1-5）

| 配置 | 值 | 说明 |
| --- | --- | --- |
| `sourcemap` | `false` | 安全：禁用 sourcemap |
| `base` | `process.env.VITE_BASE ?? "/"` | 可配子路径 CDN |
| `manualChunks` | 7 组 vendor | react / zustand / recharts / xterm / yjs / monaco / security |

### 分包效果

| Chunk | gzip | 加载时机 |
| --- | --- | --- |
| index + vendor-react | **82KB** | 首屏 |
| vendor-monaco | 861KB | lazy（Monaco 面板激活时） |
| vendor-xterm | 104KB | lazy（终端面板激活时） |
| 语言模式 | 各<20KB | 按需（Solidity/PGSQL/...） |

---

## 约束与铁律

1. **新文件 tsc 零错误** —— `pnpm exec tsc --noEmit`
2. **补 vitest** —— 模块带测试入库
3. **禁 `@ts-nocheck`** —— 全仓源码零残留
4. **禁单引号 `${}` 模板串** —— 日志输出打字面 `${...}`
5. **路径就近** —— `from "../logger"` 而非 `from "../services/logger"`
6. **零硬依赖可选 SDK** —— e2b / @cloudflare/sandpack 仅 `import(/* @vite-ignore */)`
7. **Actions SHA 固定** —— CI 不用浮动标签
8. **CSP + 隔离头** —— `_headers` + meta CSP

---

## 已知值环（ESM 安全）

- `services/llm/LLMService.ts` ↔ `AIDegradationService.ts`（值级互调，仅函数体内）

## 已清理项

- ~~22 个 deprecated 存根~~ / ~~@ts-nocheck~~ / ~~单引号 `${}` bug~~ / ~~logger 反向依赖~~
