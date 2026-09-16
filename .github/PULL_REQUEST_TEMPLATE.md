<!-- 标题格式 Title: <type>(<scope>): <subject>  e.g. feat(workbench): 支持文件树拖拽移动 -->

## 📌 变更类型 | Type of Change
<!-- 必选一个类型标签 + 模块标签 Pick one type label + module label(s) -->

- [ ] `feature` 新功能 New feature
- [ ] `enhancement` 功能增强 Enhancement
- [ ] `bug` 缺陷修复 Bug fix
- [ ] `documentation` 文档 Documentation
- [ ] `performance` 性能 Performance
- [ ] `security` 安全 Security
- [ ] `ci` 流水线 / 构建 Pipeline & build
- [ ] `breaking-change` 破坏性变更 Breaking change

## 🎯 目标模块 | Module(s)
<!-- e.g. mod:workbench / mod:visualization / mod:security / mod:infra / mod:docs -->

## 📝 变更说明 | Description
<!-- 中文在上，英文在下 Chinese first, English second -->

**中文**:

**English**:

## 🔗 关联 Issue | Related Issues
<!-- e.g. Closes #123 -->

## ✅ 自检清单 | Checklist

- [ ] 基于最新 `main` 分支 Based on latest `main`
- [ ] 提交符合 Conventional Commits Commit messages follow Conventional Commits
- [ ] `pnpm exec tsc --noEmit && pnpm test:coverage` 本地通过 Local gates pass
- [ ] 已按 [`docs/LABELS.md`](../docs/LABELS.md) 打标签 Labels applied per policy
- [ ] 新增代码有测试 Tests included for new code（缺陷修复附回归用例）
- [ ] 涉及 UI / 主题时已核对 [`docs/visualization-spec.md`](../docs/visualization-spec.md)
- [ ] 文档已同步（`docs/` 或 `README.md` 索引登记）Docs synced if applicable
- [ ] 无硬编码密钥（`VITE_` 变量会进 bundle，勿放长期密钥）No hardcoded secrets

## ⚠️ 破坏性变更 | Breaking Changes（如无请删除本节 Remove if none）

**迁移说明 | Migration notes**:

## 📸 截图 / 示例 | Screenshots / Examples（可选 Optional）
