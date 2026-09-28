---
file: 04-页面实测与lint根治专项报告.md
description: YYC3-Family-IDE-Matrix 全端图标/字体/lint根治/页面实测 - solo - 2026-09-28
author: AI Tutor <solo-agent>
version: v1.0.0
created: 2026-09-28
updated: 2026-09-28
status: stable
tags: [ui-audit],[lint],[csp],[playwright],[modal]
category: report
---

# 📕 页面实测与 lint 根治专项报告

## 会话信息

| 属性 | 值 |
| ---- | -- |
| **任务来源** | 用户指令：全端 logo 配置 / lint flat config 根治 / dev server 实测（图标·布局·字体·弹窗）/ 提交 main |
| **代码基线** | `85af4af` → 本次提交（见文末） |
| **实测工具** | Playwright (chromium headless) + Vite dev server @3032 |

## 一、全端图标配置 ✅

**资产来源**：`public/yyc3/`（Android/Web App/iOS/macOS/watchOS 五端图标库）

| 端 | 落位 | 验证 |
| ---- | ---- | ---- |
| Web Favicon | `ide/public/icons/favicon-16/32.png` → `index.html link rel=icon` | HTTP 200 image/png |
| iOS | `apple-touch-icon.png` (180px) → `link rel=apple-touch-icon` | HTTP 200 |
| PWA/Android | `android-chrome-192/512.png` → manifest icons（512 兼任 maskable） | 全部 200 |
| 分享卡片 | og:image → `https://ide.yyc3.top/icons/android-chrome-512.png` | 已配置 |
| 元信息 | theme-color #06b6d4 / apple-mobile-web-app-title「YYC³」/ manifest lang zh-CN | 已配置 |

修复前问题：favicon/manifest 指向非标准尺寸的 `/yyc3-family.png`，缺 apple-touch / theme-color / og 全套。

## 二、lint 根治（P1 遗留项闭环）✅

**技术决策链**（三次实证后收敛）：

| 方案 | 结果 | 结论 |
| ---- | ---- | ---- |
| ❌ pnpm patch 解除 typescript-eslint TS7 硬抛 | parser 可启动，但 `ts.Extension` 等运行时 API 缺失致深层崩溃；TS7 原生 API 面差异过大 | 补丁链不可控，放弃 |
| ✅ **TypeScript 收敛 `~6.0.3`**（官方支持区间 `>=4.8.4 <6.1.0`） | parser + plugin（135 规则）全量可用，零补丁 | **采用**；TS7 待 typescript-eslint#10940 支持后再升 |
| ⚠️ eslint-plugin-react | 全系 peer 最高 ESLint ^9.7，ESLint 10 下 `context.getFilename` 崩溃 | 暂移除；待上游适配后回归 |

**交付物**：
- [eslint.config.mjs](../../../ide/eslint.config.mjs)（flat config：@eslint/js + react-hooks + typescript-eslint 非类型感知 + vitest globals 层）
- 删除传统 `.eslintrc.json`；lint script 去除 ESLint 10 已废弃的 `--ext`
- `preserve-caught-error`（ESLint 10 新规则）实修 4 处：错误链补 `{ cause }`（MCPClient×2 / CloudSyncService / DataImporter）
- `no-useless-assignment` 实修 2 处（ErrorReportingService.test / lttb）
- `void-use-memo` 实修 1 处：IdeWorkbench Monaco 预热 useMemo→useEffect（副作用语义归位）
- TS/TSX 关闭 `no-undef`（typescript-eslint 官方准则：标识符存在性由 tsc 门禁负责）

**门禁结果**：`pnpm lint` → **0 errors**（324 warnings 为历史噪音，11 个可 --fix）

## 三、字体统一 ✅

| 令牌 | 统一栈 | 覆盖面 |
| ---- | ---- | ---- |
| sans | `ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif` | index.html body / tailwind `--font-sans` / visualization 主题（531 元素实测一致） |
| mono | `"JetBrains Mono", "Fira Code", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace` | tailwind `--font-mono` / Monaco / XTerm / CustomTheme / visualization（94 元素实测一致） |

实测偏差说明：55+15 元素为 Monaco 编辑器内部自管字体、1 个 codicon 图标字体——属编辑器封闭体系，不影响全局统一性。

修复点：main.tsx `system-ui, sans-serif`→inherit；XTerminal/Monaco/CustomTheme mono 栈五处对齐（Fira Code/JetBrains Mono 先后次序统一，移除 Courier New/Cascadia 等异源）。

## 四、页面全链路实测（Playwright）✅

### 4.1 CSP 三处修复（控制台错误 9 → 2 且余项为第三方）

| 问题 | 影响 | 修复 |
| ---- | ---- | ---- |
| `frame-ancestors` 经 meta 下发无效（浏览器报错×5） | 控制台噪音 | 移除；防点击劫持应由部署层 header 承担（GitHub Pages 不支持自定义 header，已注记） |
| AI 助手探测 Ollama `localhost:11434` 被 connect-src 阻断 | **本地 AI 功能失效** | connect-src 增补 `http://localhost:* http://127.0.0.1:*` |
| Sandpack 代码沙箱 iframe 被 default-src 阻断 | **代码预览失效** | frame-src 增补 `https://*.sandpack-static-server.codesandbox.io` |

### 4.2 弹窗链路缺陷修复 ✅

**实测发现**：分享 / API 密钥两个全屏 overlay 打开后 **Esc 无法关闭**（此前探针 6 处点击超时的根因——overlay 常驻拦截全部交互）。

**修复**：[WorkbenchTopBar.tsx](../../../ide/components/workbench/WorkbenchTopBar.tsx) 增加统一 Esc 关闭 effect（toolbarActive 聚合态监听 keydown）。

**修复后全链路验证**：

| 链路 | 开启 | Esc 关 | 重开 | backdrop 关 | 内容 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| 分享 | ✅ | ✅ | ✅ | ✅ | 快照链接 + 复制完整 |
| API 密钥 | ✅ | ✅ | ✅ | ✅ | 密钥管理 + AES-256-GCM 说明完整 |

### 4.3 其余实测结论

- **图标**：favicon×2 / apple-touch / manifest×5 全部 200
- **布局**：视口 1440×900 下零非预期溢出（Monaco 内部 lines-content 大宽度属编辑器实现）
- **主题循环**：赛博朋克 ↔ 深海军蓝连续切换正常无卡滞
- **交互元素**：60 个可交互控件（顶栏 8 / 面板控制 4 / 文件操作 2 / 标签页 3 等）均可聚焦命中

## 五、门禁与产物

| 门禁 | 结果 |
| ---- | ---- |
| `tsc --noEmit`（TS 6.0.3） | 0 错误 |
| `pnpm lint`（ESLint 10 flat） | 0 errors |
| `pnpm test` | 57 文件 / 1148 用例全绿（1.43s） |
| `pnpm build` | 1.04s；dist 含 index/CNAME/manifest/icons 齐备 |

## 六、后续建议

1. **[P2]** typescript-eslint 支持 TS ≥7.1 后：TS 升回 7.x + 移除本次收敛注记（跟踪 #10940）
2. **[P2]** eslint-plugin-react 发布 ESLint 10 适配后回归 react/* 规则层
3. **[P3]** 324 条 lint warnings 分批清理（11 条可自动修复优先）；`pnpm.overrides` 死配置清理（vite/esbuild peer 冲突来源）
4. **[P3]** Monaco 大 chunk（2.7MB）持续观察，rolldown codeSplitting 可选优化
