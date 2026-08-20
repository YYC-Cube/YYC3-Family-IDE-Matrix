# 开发者指南

> 环境搭建 / 代码规范 / 核心模块 / 调试 / 测试 / 部署

## 1. 环境搭建

### 前置依赖

| 工具 | 版本要求 | 检查命令 |
| --- | --- | --- |
| Node.js | ≥ 18 | `node --version` |
| pnpm | ≥ 8 | `pnpm --version` |

### 安装与启动

```bash
# 克隆项目
git clone git@github.com:YYC-Cube/YYC3-Family-IDE-Matrix.git
cd YYC3-Family-IDE-Matrix/ide

# 安装依赖
pnpm install

# 启动开发服务器（HMR）
pnpm dev

# 构建生产版本
pnpm build

# 启动协作服务端（可选）
pnpm collab:server
```

### 环境变量

复制 [`ide/.env.example`](../ide/.env.example) 为 `.env.local`，按需填写：

```bash
VITE_COLLAB_SERVER_URL=ws://localhost:1234   # 协作服务端
VITE_SANDBOX_PROVIDER=dry-run                 # 终端沙箱（e2b/cloudflare/dry-run）
```

> ⚠️ `VITE_` 前缀变量会进客户端 bundle，**切勿放置私密长期密钥**。

---

## 2. 代码规范

### 文件标头

所有 `.ts` / `.tsx` 文件头部使用统一注释块：

```typescript
/**
 * @file: 文件名.ts
 * @description: 一句话说明
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: YYYY-MM-DD
 * @updated: YYYY-MM-DD
 * @status: active | dev | placeholder | deprecated
 * @tags: [tag1],[tag2]
 */
```

### 命名规范

| 对象 | 规则 | 示例 |
| --- | --- | --- |
| 组件文件 | PascalCase | `AgentMarket.tsx` |
| 组件目录 | kebab-case | `panel-host/` |
| Hook | `use{Xxx}.ts` | `useMultiAgentDispatch.ts` |
| 服务 | `{domain}/` 子目录 | `services/terminal/` |
| 类型 | `{domain}.ts` in types/ | `types/agent.ts` |
| 常量 | UPPER_SNAKE_CASE | `SANDBOX_POLICY_DEFAULTS` |

### 日志规范

```typescript
import { logger } from "@/lib/logger";

logger.info("常规信息");     // 正常流程
logger.warn("需要注意");     // 非预期但可继续
logger.error("错误", err);  // 需要关注
```

**级别纪律**：
- `warn` 仅用于非常规但可继续的场景（**不用于常规流程**）
- `error` 用于需要关注的异常

### 依赖铁律

| 规则 | 说明 |
| --- | --- |
| 禁 `@ts-nocheck` | 全仓源码零残留 |
| 禁单引号 `${}` | 日志打字面 `${...}` 而非插值 |
| 路径就近 | `from "../logger"` 而非 `from "../services/logger"` |
| 零硬依赖可选 SDK | e2b/cloudflare 仅 `import(/* @vite-ignore */)` |
| barrel 出口 | 每个域 `index.ts` 统一出口 |

---

## 3. 核心模块开发指南

### 3.1 MCP 客户端（services/mcp/）

```typescript
import { createMCPClient, MCPToolManager } from "@/services/mcp";

const client = createMCPClient({ serverUrl: "https://mcp.example.com" });
await client.connect();

const tools = new MCPToolManager(client);
const content = await tools.fs.readFile("/path/to/file");
```

**升级 2026-07-28 规范**：无握手、HTTP 头路由（`MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name`）、可选 `server/discover`、列表响应 `ttlMs` + `cacheScope` 缓存提示。

### 3.2 多 Agent 流水线（hooks/useMultiAgentDispatch）

```typescript
import { useMultiAgentDispatch } from "@/hooks/useMultiAgentDispatch";

const { executePipeline, state } = useMultiAgentDispatch();
await executePipeline("做一个计数器组件");
// state.results 依次包含 planner → coder → tester → reviewer 输出
```

**降级链**：流式失败 → 非流式回退 → Provider 切换（Ollama→智谱）→ 兜底空串。

### 3.3 沙箱终端（services/terminal/）

```typescript
import { createTerminalService } from "@/services/terminal";

const { service, provider, degraded } = await createTerminalService({
  provider: "e2b",
  apiKey: "e2b-key",          // 仅运行时传 SDK，不落盘
  sdkLoader: () => import("e2b"),
});

const result = await service.execute("session", {
  command: "echo", args: ["hello"],
});
```

**策略闸门管线**：元字符检查 → 白名单 → 会话配额 → 超时截断 → 供应商执行 → 审计落账。
拒绝语义：`denied=126` / `quota=129` / `timeout=124`。

### 3.4 Yjs 协作（services/collab/）

```typescript
import { createCollabServiceFromConfig } from "@/services/collab";

const collab = createCollabServiceFromConfig({
  serverUrl: "wss://collab.example.com",
  room: "proj-42",
  userName: "YYC³",
});
collab.connect();

// Monaco 绑定
const unbind = collab.bindEditor(monacoEditor, "src/App.tsx");
```

**服务端**：`pnpm collab:server`（自建 y-websocket 兼容，见 `collab-server/README.md`）。

### 3.5 面板宿主（components/panel-host/）

```tsx
import { PanelManagerProvider, PanelRegistryProvider, PanelShell } from "@/components/panel-host";

<PanelManagerProvider>
  <PanelRegistryProvider panels={{ code: CodePanel, terminal: TerminalPanel }}>
    <PanelShell />
  </PanelRegistryProvider>
</PanelManagerProvider>
```

**布局编辑**：`splitPanel` / `mergePanel` / `swapPanels`（DnD 落点） / `resizeSibling`（分隔条） / `floatPanel`（浮出） / `dockFloating`（停坞）。

### 3.6 IDE 工作台（components/workbench/）

```tsx
import { IdeWorkbench } from "@/components/workbench";

<IdeWorkbench collabService={collab} />
```

自动组装 Monaco（lazy + Suspense + preload）、沙箱化终端、Agent 市场、协作面板、预设切换工具栏。

---

## 4. 测试

### 命令

```bash
pnpm test                    # 全量 1040 用例
pnpm test:watch              # 监听模式
pnpm test:coverage           # 覆盖率报告
pnpm exec vitest run services/mcp   # 单域运行
```

### 测试基建

- 环境：jsdom
- 全局 setup：`test-setup/jsdom-polyfills.ts`（Blob/File `.text()` polyfill + ResizeObserver + RTL cleanup + jest-dom）
- 库：Vitest 1.6 + @testing-library/react + jest-dom matchers

### 编写规范

```typescript
import { describe, it, expect, vi } from "vitest";

describe("模块名", () => {
  it("应该...（中文描述场景）", async () => {
    const result = await fn();
    expect(result).toMatchObject({ key: "value" }); // 深断言优于 toBe
  });
});
```

### CI 门禁

`.github/workflows/ide-test-coverage.yml` 在 PR 时运行全量测试 + 覆盖率检查。

---

## 5. 调试技巧

### 日志级别

```typescript
import { setLogLevel } from "@/lib/logger";
setLogLevel("debug");   // 开发时查看全部
setLogLevel("error");   // 生产仅错误
```

### React DevTools

- 安装 [React Developer Tools](https://react.dev/learn/react-developer-tools) 浏览器扩展
- Zustand 状态：React DevTools → Components → 选中组件 → Hooks 标签

### 单元测试调试

```bash
# 运行单个文件
pnpm exec vitest run services/terminal/__tests__/TerminalSandbox.test.ts

# 监听模式
pnpm exec vitest services/mcp
```

---

## 6. 部署

### 前端（静态站点）

```bash
pnpm build        # 产出 dist/
# 上传到 Vercel / Netlify / Cloudflare Pages / Nginx
```

### 协作服务端

```bash
pm2 start collab-server/server.mjs --name yyc3-collab
# 前置 Nginx wss：
#   location / { proxy_pass http://127.0.0.1:1234;
#     proxy_http_version 1.1;
#     proxy_set_header Upgrade $http_upgrade;
#     proxy_set_header Connection "upgrade"; }
```

详细配置（TTL / 持久化 / 环境变量）见 [`collab-server/README.md`](../ide/collab-server/README.md)。

### 环境变量清单

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_COLLAB_SERVER_URL` | `ws://localhost:1234` | 协作服务端地址 |
| `VITE_COLLAB_ROOM` | `yyc3-default` | 默认房间名 |
| `VITE_COLLAB_USER_NAME` | `本机开发者` | 默认显示名 |
| `VITE_SANDBOX_PROVIDER` | `dry-run` | 终端沙箱供应商 |
| `VITE_E2B_API_KEY` | — | E2B API Key（仅运行时透传） |
| `VITE_CF_SANDBOX_API_KEY` | — | Cloudflare Sandbox Key |
| `HOST` | `127.0.0.1` | 协作服务端绑定地址 |
| `PORT` | `1234` | 协作服务端端口 |
| `ROOM_TTL_MS` | `600000` | 房间 TTL（0 = 禁用回收） |
| `PERSIST_DIR` | `./collab-server/data` | 快照目录（空串 = 禁用） |

---

## 7. 监控

### 前端监控

- `services/ErrorReportingService.ts`：全局异常捕获 + 面包屑 + 采样 + 本地/远端 transport
- `services/PerformanceMonitor.ts`（stores/）：Web Vitals / 组件渲染

### 服务端监控

```bash
curl http://localhost:1234/healthz
# {"ok":true,"rooms":3,"persistence":true,"roomTtlMs":600000,"ts":...}
```
