<!--
  file: docs/evolution-plan.md
  description: YYC³ IDE 功能演进实施方案与建议 — 基于 2026-08-28 全链路生产闭环审核
  author: YanYuCloudCube Team <admin@0379.email>
  version: v1.0.0
  created: 2026-08-28
  updated: 2026-08-28
  status: active
  tags: [docs,evolution,plan,production,audit]
-->

# 功能演进实施方案与建议

> 基于全链路生产闭环审核（2026-08-28），整合安全终审（4 必修 + 4 建议 + 3 可缓）
> 与质量终审（能力矩阵 + 性能 + 可观测性 + 部署）的完整发现，形成可执行的分阶段实施方案。

---

## 一、当前状态总览

| 指标 | 数值 | 状态 |
| --- | --- | --- |
| 测试用例 | **1040 全绿**（49 文件） | ✅ |
| tsc 错误 | **0** | ✅ |
| Dependabot 告警 | **0**（已修复 9→0） | ✅ |
| @ts-nocheck 残留 | **0** | ✅ |
| 全局语句覆盖率 | 45.75% | ⚠️ 阻塞项见下 |
| dist/ 总量 | 13MB（JS gzip 3.2MB） | ⚠️ 主包超标 |
| 生产闭环判定 | **有条件放行内部 Beta** | 🔶 |

**核心判断**：代码级质量已达标，但「生产闭环」尚未形成。缺口集中在**接线层**（可观测性/CI 部署/安全头/密钥链路），而非实现层。**约 5-8 人日可闭环**。

---

## 二、安全必修项（部署阻断）

### R1 协作服务端无来源/身份校验

**风险**：CSWSH（Cross-Site WebSocket Hijacking）——任意网页可跨站连接公开 wss 端点读写房间；无 maxPayload（ws 默认 100MiB）可被内存耗尽攻击。

**位置**：`collab-server/server.mjs:287-298`

**实施方案**（1 人日）：
```
1. Origin 白名单：`COLLAB_ALLOWED_ORIGINS` 环境变量（逗号分隔），拒绝不在列表的连接
2. 连接 token：`COLLAB_AUTH_TOKEN` 环境变量，客户端 URL 查询参数 `?token=` 校验
3. WebSocketServer({ server, maxPayload: 1_048_576 }) — 1MB 上限
4. 房间数上限：`COLLAB_MAX_ROOMS`（默认 100），超出拒绝新房间
5. 连接速率限制：简单令牌桶（每 IP 每分钟 ≤30 连接）
```

### R2 密钥明文双轨

**风险**：`LLMService.getApiKey()` 将 API Key 明文存 localStorage，浏览器直发 `Bearer`——APIKeyVault 的 AES-GCM 加密在真实链路中被完全旁路。

**位置**：`services/llm/LLMService.ts:90-96`（明文存储） + `:345-347`（直发）

**实施方案**（2 人日）：
```
阶段一（最小修复）：请求层 buildHeaders() 改从 APIKeyVault 读取（异步化）
阶段二（服务端代理）：实现 ProxyService 真发送——Key 仅存服务端，
                    浏览器请求全部经服务端代理转发（当前 status: dev）
```

### R3 无 CSP/隔离头

**风险**：无 Content-Security-Policy，XSS 可加载任意外部脚本。

**位置**：全仓（无任何 CSP 配置）

**实施方案**（0.5 人日）：
```
1. index.html 加 meta CSP（开发期宽松 + 生产严格）
2. Nginx/vercel.json 下发响应头：
   - Content-Security-Policy: default-src 'self'; ...
   - Cross-Origin-Opener-Policy: same-origin
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
```

### R4 CI 未哈希固定

**风险**：GitHub Actions 使用 @v4/@v7 浮动标签（可被上游重定向注入恶意代码）；workflow_dispatch 输入直接内插 bash（脚本注入面）。

**位置**：`.github/workflows/ide-test-coverage.yml:90/94/133/169/201`

**实施方案**（0.5 人日）：
```
1. 所有 actions/*/* 改用 40 位 commit SHA 固定
2. 顶层加 permissions: contents: read
3. workflow_dispatch 输入经 env: 传递（不直接内插 bash）
```

---

## 三、质量攻坚项

### Q1 可观测性接线（1 人日）——最高优先

**现状**：ErrorReportingService 架构完整但 `initErrorReporting` **全仓零调用**。全局异常捕获在运行时不存在。`SentryTransport.send()` 是模拟实现（仅 console.warn）。

**实施方案**：
```
1. src/main.tsx 调用 errorReporting.init({ dsn: import.meta.env.VITE_SENTRY_DSN })
2. 实现 SentryTransport 真发送（fetch 到 Sentry ingest endpoint）
3. 根组件加 ErrorBoundary（消费 captureRenderError）
4. PerformanceMonitor 加 Web Vitals 采集 + 定期上报
```

### Q2 存储层测试攻坚（2-3 人日）

**现状**：`services/storage/` 覆盖率 39.8%（3318 语句）——全库最大域，直接对应数据丢失路径。

**优先子项**：
| 模块 | 当前覆盖 | 目标 | 原因 |
| --- | --- | --- | --- |
| IndexedDBAdapter | 10.3% | ≥80% | 核心持久层，双版本合并后未补测 |
| CloudSyncService | 16.5% | ≥70% | 冲突解决 + 重试 + flush 时序 |
| DataImporter | 21.2% | ≥80% | 数据导入路径（Sanitizer 已有） |
| BackupService | 已有 | — | 维持 |

### Q3 APIKeyVault 测试补齐（0.5 人日）

**现状**：12 个方法仅 1 个被测（函数覆盖 6.66%）——安全域唯一阻塞项。

### Q4 主包瘦身 + vite.config.ts（1 人日）

**现状**：首屏 gzip 187KB（目标 <120KB）。recharts、xterm、yjs 全家桶全部进了首屏。

**实施方案**：
```
1. 创建 vite.config.ts：base 可配 + sourcemap: false + manualChunks 分包
2. recharts → React.lazy（LatencyTrendChart 等可视化面板按需加载）
3. xterm → 已在 TerminalPanel 消费但未 lazy（加 React.lazy）
4. yjs 全家桶 → CollabPanel 消费时 lazy
5. favicon 修复：public/ 目录从仓库根复制到 ide/public/
```

### Q5 CI 补 build + deploy 阶段（0.5 人日）

**现状**：CI 仅测试矩阵，无构建、无部署。

**实施方案**：
```
1. 新增 build job：pnpm build + 产物上传 artifact
2. 新增 deploy stage（可选）：Vercel/Netlify/Cloudflare Pages
3. 恢复分层覆盖率阈值（安全/存储 ≥80%，UI 域暂缓）
4. 新增 pnpm audit --prod 检查 job
```

---

## 四、功能演进路线图

### Phase 1 · 生产闭环（本周 · 5-8 人日）

| 序号 | 任务 | 人日 | 依赖 |
| --- | --- | --- | --- |
| 1 | 可观测性接线（Q1） | 1 | — |
| 2 | CI 安全加固（R4） | 0.5 | — |
| 3 | CSP/隔离头（R3） | 0.5 | — |
| 4 | 协作服务端鉴权（R1） | 1 | — |
| 5 | APIKeyVault 测试（Q3） | 0.5 | — |
| 6 | vite.config + 主包瘦身（Q4） | 1 | — |
| 7 | CI build+deploy（Q5） | 0.5 | 6 |
| 8 | 存储层测试（Q2） | 2-3 | — |

**交付物**：可部署的内部 Beta（安全+可观测+CI 完整闭环）

### Phase 2 · 安全增强（下周 · 3-4 人日）

| 序号 | 任务 | 人日 | 说明 |
| --- | --- | --- | --- |
| 1 | 密钥服务端代理（R2 阶段二） | 2 | ProxyService 真发送 |
| 2 | 密钥口令派生（A1/M4） | 1 | PBKDF2/Argon2id + WebAuthn PRF |
| 3 | 供应链门禁（A2） | 0.5 | pnpm audit + CodeQL + Dependabot |
| 4 | 沙箱审计持久化（C1/L2） | 0.5 | IndexedDB append-only |

### Phase 3 · 功能增强（后续 · 按需排期）

| 方向 | 说明 | 前置 |
| --- | --- | --- |
| 多文件编辑 | FileStore 接入 MonacoPanel + Tab 管理 | FileStore 有（stores/useFileStoreZustand） |
| Sandpack 预览 | 接入 @codesandbox/sandpack-react + FileStore | 占位组件已就绪 |
| AI 补全增强 | AICompletionService 真发送（当前 monaco 集成完整但 LLM 层走 stub） | LLMService 就绪 |
| 插件市场上线 | PluginMarketPanel 真接 registry + 签名校验 | A4/M2 |
| 移动端适配 | ResponsivePanelShell + 触控手势 | — |
| 多语言完善 | i18n 字典补齐（当前仅中英骨架） | — |
| Electron 桌面 | Electron + TauriBridge + 本地文件系统 | TauriBridge 有（归档） |

---

## 五、能力域 × 四维矩阵（终审数据）

| 能力域 | 覆盖率 | API | 测试 | 文档 | Hardening |
| --- | --- | --- | --- | --- | --- |
| 协作 (collab) | 93.0% | ✅ | ✅ | ✅ | ✅ |
| 终端 (terminal) | 94.8% | ✅ | ✅ | ✅ | ⚠️ 审计内存 |
| Agent 编排 | 94.9% | ✅ | ⚠️ | ✅ | ✅ |
| 面板宿主 | 92.6% | ✅ | ✅ | ✅ | ✅ |
| 工作台 (Monaco) | 99.2% | ✅ | ✅ | ✅ | ⚠️ 主包 |
| 安全 (security) | 75.7% | ✅ | ⚠️ | ✅ | ⚠️ Vault |
| MCP | 71.8% | ✅ | ⚠️ | ✅ | ✅ |
| LLM | 68.1% | ✅ | ⚠️ | ✅ | ⚠️ 密钥 |
| 可视化 | 64.8% | ✅ | ⚠️ | ✅ | ✅ |
| 存储 (storage) | 39.8% | ✅ | ❌ | ✅ | ❌ |
| 插件 (plugins) | 15.2% | ✅ | ❌ | ⚠️ | ⚠️ |
| 状态 (stores) | 13.6% | ✅ | ❌ | ⚠️ | ⚠️ |

---

## 六、性能预算

| 指标 | 当前 | 目标 | 优化路径 |
| --- | --- | --- | --- |
| dist 总量 | 13MB | ≤10MB | 语言模式按需 + worker 共享 |
| 首屏 gzip | 187KB | <120KB | recharts/xterm/yjs lazy 化 |
| Monaco chunk | 872KB gzip | 维持 | 已 lazy，按需加载可接受 |
| ts.worker | 5.8MB | 维持 | 仅 TS 语言服务激活时拉取 |
| 语言模式 | 各<20KB | 维持 | 逐语言拆分策略正确 |

---

## 七、遗留观察项（记录不阻塞）

| 项 | 严重度 | 说明 | 建议时机 |
| --- | --- | --- | --- |
| M1 插件 HTML 休眠 XSS | 中 | panel:show 无消费者，落地时必须 dompurify | 面板消费者实现时 |
| M2 插件市场无签名 | 中 | manifest 无 ed25519 签名/哈希校验 | 市场上线前 |
| C3 GCM IV 16B 非标 | 低 | EncryptionService maximum 档应 12B | 下次安全迭代 |
| C2 零引用依赖 14 个 | 低 | @radix-ui×9 等 UI 组装期预留 | 组装期审查 |
| strict:false | 低 | tsconfig 全局非严格 | 渐进开启 |

---

## 八、安全终审已验证良好项

- M3 CSRF 常数时间比较 ✅
- H3 APIKeyVault 掩码回写修复 ✅
- H2 env 密钥 no-op + .env.example 警告 ✅
- 构建产物无 sourcemap（0 个 .map）✅
- lockfile 已提交 + CI `--frozen-lockfile --ignore-scripts` ✅
- VITE_ 变量仅 6 个，dist 实测无密钥值泄漏 ✅
- .env 家族已 gitignore ✅
- 房间持久化已防目录穿越 ✅

---

## 九、判定与行动

> **当前可放行内部 Beta**（代码质量已达标）。
> **对外生产发布需完成 Phase 1 全部 8 项**（约 5-8 人日）。

**下一步行动**：
1. 立即执行 Phase 1 #1-#4（安全+可观测，约 3 人日）
2. 本周内完成 #5-#8（CI+性能+存储测试，约 4-5 人日）
3. Phase 2 安全增强排入下周
4. Phase 3 功能增强按用户反馈排期

---

*审计来源：安全终审（智云·守护）+ 质量终审（格物·宗师），2026-08-28，全程只读。*
