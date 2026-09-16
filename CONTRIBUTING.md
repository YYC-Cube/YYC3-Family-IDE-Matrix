<!--
  file: CONTRIBUTING.md
  description: YYC³ Family IDE Matrix · 贡献指南
  author: YanYuCloudCube Team <admin@0379.email>
  version: v1.0.0
  created: 2026-09-16
  updated: 2026-09-16
  status: active
  tags: [contributing,workflow,standards]
-->

# 贡献指南 | Contributing Guide

> 感谢您关注 YYC³ Family IDE Matrix！本指南帮助您快速完成第一次贡献。
> Thanks for your interest! This guide gets your first PR merged fast.

---

## 1. 快速通道 | Fast Path

```bash
# 1. Fork & Clone
git clone https://github.com/<your-fork>/YYC3-Family-IDE-Matrix.git
cd YYC3-Family-IDE-Matrix/ide

# 2. 安装依赖（pnpm ≥ 8；packageManager 锁定 pnpm@9.0.0）
corepack enable && corepack prepare pnpm@9.0.0 --activate
pnpm install --frozen-lockfile

# 3. 分支 & 开发（开发服务器端口 3030 起 🚨）
git checkout -b feat/multi-file-drag-drop
pnpm dev

# 4. 本地门禁（与 CI 同款 same gates as CI）
pnpm exec tsc --noEmit && pnpm test:coverage

# 5. 提交并推送（Conventional Commits）
git commit -m "feat(workbench): 支持文件树拖拽移动"
git push origin feat/multi-file-drag-drop
# 6. 在 GitHub 上开 PR，按模板勾选类型/模块并完成自检清单
```

---

## 2. 环境要求 | Prerequisites

| 依赖 Dependency | 版本 Version | 必需 Required |
| --- | --- | :---: |
| Git | 2.40+ | ✅ |
| Node.js | 18+（CI 矩阵 18 / 20 / 22） | ✅ |
| pnpm | 9.0.0（`packageManager` 锁定） | ✅ |
| 浏览器 | Chrome / Edge 最新版（Monaco + WebCrypto + IndexedDB） | ✅ |
| Docker | 24+（可选，协作/沙箱服务端容器化） | ⬜ |

---

## 3. 分支模型 | Branching Model

```
main (发布主线 protected)   ←─ 仅接受经评审的 PR
 ├── feat/*      功能开发 features
 ├── fix/*       缺陷修复 bug fixes
 ├── docs/*      文档 documentation
 ├── perf/*      性能 performance
 ├── ci/*        流水线与构建 pipeline & build
 └── refactor/*  重构（不改行为）refactoring
```

- `main` 为发布主线，建议开启分支保护（必需检查 + 审批），禁止 force-push。
  `main` is the release line; branch protection (required checks + review) is recommended; force-push disabled.
- 功能分支生命周期 ≤ 2 周，过期请 rebase 到最新 `main`。
  Feature branches live ≤ 2 weeks; rebase onto latest `main` when stale.
- 提交前先跑 `pnpm test:coverage`，避免 CI 反复往返。

---

## 4. 提交规范 | Commit Convention

遵循 **Conventional Commits**：

```text
<type>(<scope>): <subject>

<body 可选 optional>
<footer 可选 optional>   # e.g. BREAKING CHANGE: 迁移说明 / Closes #123
```

| type | 用途 Usage | 对应标签 Label |
| --- | --- | --- |
| `feat` | 新功能 new feature | `feature` |
| `fix` | 缺陷修复 bug fix | `bug` |
| `docs` | 文档 documentation | `documentation` |
| `perf` | 性能 performance | `performance` |
| `refactor` | 重构（不改行为）refactor | `enhancement` |
| `test` | 测试 tests | — |
| `ci` | 流水线 / 构建 pipeline & build | `ci` |
| `chore` | 杂项 chores | — |

**scope 建议 suggested scopes**（对应模块标签，见 [`docs/LABELS.md`](docs/LABELS.md)）：
`workbench` · `panel-host` · `agent` · `terminal` · `visualization` · `model-settings` · `plugins` · `snapshot` · `mcp` · `llm` · `context` · `security` · `storage` · `collab` · `electron` · `infra` · `docs`

---

## 5. 标签使用 | Labels

提交 Issue / PR 时请按 [`docs/LABELS.md`](docs/LABELS.md) 选择标签：
Issue 需 **1 类型 + 1 模块 + 1 优先级**；PR 需 **1 类型 + 1 模块**。
Pick labels per [`docs/LABELS.md`](docs/LABELS.md): type + module + priority for Issues; type + module for PRs.
机器可读清单：[`.github/labels.json`](.github/labels.json)（可配合 [github-label-sync](https://github.com/Financial-Times/github-label-sync) 同步）。

---

## 6. 质量门禁 | Quality Gates

| 门禁 Gate | 命令 Command | 通过标准 Pass criteria |
| --- | --- | --- |
| 类型检查 Type check | `pnpm exec tsc --noEmit` | 0 errors |
| 单元测试 Unit test | `pnpm test` | 全部通过（当前 1056 用例） |
| 覆盖率 Coverage | `pnpm test:coverage` | `AgentSkills.ts` 专项 ≥ 90/95/85/90（语句/函数/分支/行） |
| Lint | `pnpm lint` | 0 errors |
| 格式 Format | `pnpm format` | Prettier 无 diff |
| 生产依赖审计 Audit | `pnpm audit --prod` | 无 critical / high |
| 构建 Build | `pnpm build` | `tsc -b && vite build` 成功 |

> 本地与 CI 使用同一 pnpm 版本与锁定依赖，确保「本地绿 = CI 绿」。
> Same pinned toolchain locally and in CI: green locally means green in CI. 详见 [`docs/CICD.md`](docs/CICD.md)。

---

## 7. PR 检查单 | PR Checklist

- [ ] 分支基于最新 `main`，提交符合 Conventional Commits
- [ ] `pnpm exec tsc --noEmit && pnpm test:coverage` 本地通过
- [ ] PR 标题、描述完整，已选类型 / 模块标签
- [ ] 新增代码有对应测试；缺陷修复附回归用例
- [ ] 涉及 UI / 主题时同步核对 [`docs/visualization-spec.md`](docs/visualization-spec.md) 令牌规范
- [ ] 文档已同步更新（`docs/` 或 `README.md` 索引同步登记）
- [ ] 不包含密钥 / 凭证（`VITE_` 变量会进 bundle，勿放长期密钥）
- [ ] 大型变更（> 500 行）已先开 Issue 对齐设计

> CI 全绿后 @ 维护者 review；破坏性变更需两人批准并附迁移说明。
> After green CI, request review; breaking changes require two approvals plus migration notes.

---

## 8. 文档贡献规范 | Documentation Standards

1. **元数据**：新增 Markdown 需在文件头以 HTML 注释声明元数据，字段与 [`README.md`](README.md) 一致：
   `file / description / author / version / created / updated / status / tags`
   New Markdown files must declare the same metadata block at the top of the file.
2. **命名**：`docs/` 下使用 kebab-case（`developer-guide.md`）；模块说明固定 `README.md`。
   Kebab-case filenames under `docs/`; module docs are always `README.md`.
3. **链接**：站内一律相对路径，禁止指向不存在的文件（提交前自查）。
   Relative links only; verify no dead links before submitting.
4. **图表**：优先 Mermaid；配色与命名遵循 [`docs/STYLE-GUIDE.md`](docs/STYLE-GUIDE.md)。
   Prefer Mermaid; colors & naming per [`docs/STYLE-GUIDE.md`](docs/STYLE-GUIDE.md).
5. **代码标头**：TypeScript 文件使用 `@file / @description / @author / @version` 标头（见 [`docs/developer-guide.md`](docs/developer-guide.md) §2）。

---

## 9. 报告缺陷 | Reporting Bugs

使用 [Bug Report 模板](.github/ISSUE_TEMPLATE/bug_report.yml)并附：复现步骤 / 期望行为 / 实际行为 / 环境信息（OS · Node · pnpm · 浏览器）/ 脱敏日志（**勿粘贴包含 API Key 的请求体**）。

安全漏洞请勿走公开 Issue —— 参见 [`SECURITY.md`](SECURITY.md)。
Do **not** open public issues for security vulnerabilities — see [`SECURITY.md`](SECURITY.md).

---

## 10. 行为准则 | Code of Conduct

参与本项目即表示您同意 [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)。
By participating, you agree to abide by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

---

## 11. 联系 | Contact

| 事项 Topic | 邮箱 Email |
| --- | --- |
| 开发问题 Development | <dev@0379.email> |
| 文档 Documentation | <docs@0379.email> |
| 技术支持 Support | <support@0379.email> |
| 安全报告 Security | <sec@0379.email> |
| 管理 Administration | <admin@0379.email> |

---

<div align="center">

**© 2025-2026 YanYuCloudCube™** · YYC³ Family IDE Matrix

</div>
