# 开发者指南

> 环境搭建 / 代码规范 / 核心模块 / 调试 / 测试 / 部署 · v2.0（Phase 1-3 完成后更新）

## 1. 环境搭建

### 前置依赖

| 工具 | 版本 | 检查 |
| --- | --- | --- |
| Node.js | ≥ 18 | `node --version` |
| pnpm | ≥ 8 | `pnpm --version` |

### 安装与启动

```bash
git clone git@github.com:YYC-Cube/YYC3-Family-IDE-Matrix.git
cd YYC3-Family-IDE-Matrix/ide

pnpm install          # 安装依赖
pnpm dev              # 开发服务器（HMR）
pnpm build            # 生产构建
pnpm collab:server    # 协作服务端（可选）
pnpm electron:dev     # Electron 桌面（可选）
```

### 环境变量

```bash
cp .env.example .env.local
```

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `VITE_COLLAB_SERVER_URL` | `ws://localhost:1234` | 协作服务端 |
| `VITE_COLLAB_ROOM` | `yyc3-default` | 默认房间 |
| `VITE_SANDBOX_PROVIDER` | `dry-run` | 终端沙箱（e2b/cloudflare/dry-run） |
| `VITE_SENTRY_DSN` | — | 错误上报（缺省降级本地存储） |
| `VITE_BASE` | `/` | 构建产物 base 路径（子路径 CDN） |

> ⚠️ `VITE_` 变量会进 bundle，**勿放密钥**。

---

## 2. 代码规范

### 文件标头

```typescript
/**
 * @file: 文件名.ts
 * @description: 一句话说明
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: YYYY-MM-DD
 * @updated: YYYY-MM-DD
 * @status: active | dev | placeholder | deprecated
 */
```

### 依赖铁律

| 规则 | 说明 |
| --- | --- |
| 禁 `@ts-nocheck` | 全仓零残留 |
| 禁单引号 `${}` | 日志打字面而非插值 |
| 路径就近 | `from "../logger"` 而非 `"../services/logger"` |
| 零硬依赖可选 SDK | e2b/cloudpack 仅 `@vite-ignore` 动态加载 |
| barrel 出口 | 每域 `index.ts` 统一出口 |
| Actions SHA 固定 | CI 不用 `@v4` 浮动标签 |

---

## 3. 核心模块开发指南

### 3.1 多文件编辑（components/workbench/）

```tsx
import { useFileStoreZustand } from "@/stores/useFileStoreZustand";
import FileExplorer from "@/components/workbench/FileExplorer";
import EditorTabs from "@/components/workbench/EditorTabs";

// FileStore API
const store = useFileStoreZustand.getState();
store.initializeProject({ "src/App.tsx": "..." }, "src/App.tsx");
store.updateFile("src/App.tsx", "new content");
store.openFile("src/index.css");   // 切换当前文件
store.closeFile("src/App.tsx");    // 关闭 Tab
```

**架构**：FileStore（状态）→ FileExplorer（树渲染）→ EditorTabs（切换）→ MonacoPanel（编辑）

### 3.2 Sandpack 实时预览（SandpackPreview.tsx）

```tsx
import SandpackPreview from "@/SandpackPreview";

// 自动从 FileStore 读取项目文件
// 自动检测模板（react-ts / static）
// 文件变更 → 500ms 延迟重编译 → 热更新
```

**技术**：`@codesandbox/sandpack-react@2.20.0`，`recompileMode: "delayed"`

### 3.3 MCP 客户端（services/mcp/）

```typescript
import { createMCPClient, MCPToolManager } from "@/services/mcp";

const client = createMCPClient({ serverUrl: "https://mcp.example.com" });
await client.connect();
const tools = new MCPToolManager(client);
const content = await tools.fs.readFile("/path/to/file");
```

**协议**：2026-07-28 无状态规范（HTTP 头路由 / `server/discover` / `ttlMs` 缓存）

### 3.4 多 Agent 流水线（hooks/useMultiAgentDispatch）

```typescript
import { useMultiAgentDispatch } from "@/hooks/useMultiAgentDispatch";

const { executePipeline, state } = useMultiAgentDispatch();
await executePipeline("做一个计数器组件");
// state.results: planner → coder → tester → reviewer
```

### 3.5 沙箱终端（services/terminal/）

```typescript
import { createTerminalService } from "@/services/terminal";

const { service, provider, degraded } = await createTerminalService({
  provider: "e2b",
  apiKey: "e2b-key",
});
const result = await service.execute("session", {
  command: "echo", args: ["hello"],
});
```

**安全管线**：元字符 → 白名单 → 配额 → 超时 → 供应商 → 审计（内存 + IndexedDB）

### 3.6 Yjs 协作（services/collab/）

```typescript
import { createCollabServiceFromConfig } from "@/services/collab";

const collab = createCollabServiceFromConfig({
  serverUrl: "wss://collab.example.com",
  room: "proj-42",
});
collab.connect();
const unbind = collab.bindEditor(monacoEditor, "src/App.tsx");
```

**服务端**：`pnpm collab:server`（Origin 白名单 + Token + 速率限制 + TTL + 持久化）

### 3.7 LLM 代理适配（services/llm/proxyAdapter.ts）

```typescript
import { smartChatCompletion, isProxyEnabled } from "@/services/llm/proxyAdapter";

// 代理启用 → 密钥在服务端（浏览器零暴露）
// 代理不可用 → 回退直发（密钥在 localStorage，仅开发）
const reply = await smartChatCompletion(provider, modelId, messages);
```

**服务端代理**：参考 `PROXY_SERVER_NODE`（Express 模板，密钥从 `process.env` 读取）

### 3.8 密钥口令派生（services/security/APIKeyVault.ts）

```typescript
import { apiKeyVault } from "@/services/security";

// 用户口令 → PBKDF2(310K) → 非导出 CryptoKey
await apiKeyVault.unlockWithPassphrase("my-secret-passphrase");
await apiKeyVault.storeKey("zai-plan", "sk-api-key");
const key = await apiKeyVault.getKey("zai-plan"); // 解密读取

// 锁定（清除内存密钥）
apiKeyVault.lock();
```

### 3.9 面板宿主（components/panel-host/）

```tsx
import { PanelManagerProvider, PanelRegistryProvider, PanelShell } from "@/components/panel-host";

<PanelManagerProvider>
  <PanelRegistryProvider panels={{
    code: MonacoPanel,
    files: FileExplorer,
    terminal: TerminalPanel,
    preview: SandpackPreview,
  }}>
    <PanelShell />
  </PanelRegistryProvider>
</PanelManagerProvider>
```

### 3.10 IDE 工作台组装（components/workbench/IdeWorkbench.tsx）

```tsx
import { IdeWorkbench } from "@/components/workbench";

<IdeWorkbench collabService={collab} />
// 自动组装：文件浏览器 + Monaco多文件 + 终端 + 市场 + 预览 + 预设切换
```

---

## 4. 测试

```bash
pnpm test              # 全量 1056 用例
pnpm test:watch        # 监听
pnest test:coverage    # 覆盖率
```

### 测试基建

- 环境：jsdom
- Setup：`test-setup/jsdom-polyfills.ts`（Blob/File `.text()` + ResizeObserver + jest-dom + RTL cleanup）
- 框架：Vitest 3.2.7 + @testing-library/react

---

## 5. 可观测性

### 错误上报

```typescript
// main.tsx 已自动初始化（DSN 缺省降级本地存储）
import { errorReporting } from "@/services/ErrorReportingService";

errorReporting.captureError(error, { category: "render", severity: "fatal" });
errorReporting.addBreadcrumb({ type: "navigation", category: "page", message: "进入设置" });
```

**Sentry 真发送**：`SentryTransport` 实现 Sentry Store API（fetch + X-Sentry-Auth）

### 终端审计

```typescript
import { SandboxPolicy } from "@/services/terminal";

const policy = new SandboxPolicy(config);
// 内存日志（即时查询）
policy.getAuditLog(100);
// 持久化日志（IndexedDB append-only，刷新后仍可查）
await policy.getPersistentAuditLog(200);
```

---

## 6. 部署

### 前端

```bash
pnpm build   # dist/ → CDN
```

### 协作服务端

```bash
pm2 start collab-server/server.mjs --name yyc3-collab
# 环境变量：COLLAB_ALLOWED_ORIGINS / COLLAB_AUTH_TOKEN / ROOM_TTL_MS / PERSIST_DIR
```

### Electron

```bash
pnpm electron:dev    # 开发模式
pnpm electron:build  # 构建桌面安装包
```

---

## 7. CI/CD 流水线

```
security-audit ──→ test-and-coverage (2 OS × 3 Node 矩阵)
              ──→ build (tsc + vite build + dist artifact)
              ──→ coverage-summary (PR 评论)
              ──→ final-status

CodeQL: push/PR/每周定期扫描
Dependabot: npm 每周 + Actions 每周
```

---

## 8. 性能预算

| 指标 | 当前 | 目标 |
| --- | --- | --- |
| 首屏 gzip | 253KB | <200KB |
| Monaco chunk | 861KB gzip | lazy 可接受 |
| ts.worker | 5.8MB | 按需可接受 |
| 语言模式 | 各<20KB | 已最优 |
