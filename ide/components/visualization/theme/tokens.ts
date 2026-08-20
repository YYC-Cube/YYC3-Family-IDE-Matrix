/**
 * file: tokens.ts
 * description: 主题令牌向后兼容层 · 重导出自 ../theme.ts (Cyberpunk-88)
 * author: YanYuCloudCube Team <admin@0379.email>
 * version: v1.0.1
 * created: 2026-08-19
 * updated: 2026-08-19
 * status: active
 * tags: [theme],[tokens],[re-export],[compatibility]
 *
 * brief: 向后兼容出口 — 所有导出均来自统一的 theme.ts
 *
 * details:
 * - v1.0.1 变更：主题定义统一迁移到 visualization/theme.ts
 * - 本文件仅做重导出，确保现有 import 路径不失效
 * - 新代码建议直接从 `../theme` 导入
 *
 * dependencies: ../theme.ts
 * exports: VISUAL_TOKENS_CYBERPUNK_88, t, VISUAL_TOKENS, VisualTokensType,
 *          SemanticRole, FamilyVisualRole,
 *          getSemanticColor, getFamilyColor, statusToSemantic, statusColor, toCssVars
 */

export {
  CYBERPUNK_88_THEME,
  VISUAL_TOKENS_CYBERPUNK_88,
  VISUAL_TOKENS,
  t,
  getSemanticColor,
  getFamilyColor,
  statusToSemantic,
  statusColor,
  toCssVars,
} from "../theme";

export type {
  VisualTokensType,
  SemanticRole,
  FamilyVisualRole,
} from "../theme";
