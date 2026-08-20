/**
 * @file: AgentSkills.ts
 * @description: [重导出] 已迁移到 services/agent/AgentSkills.ts
 * @deprecated: 请从 ./services/agent/AgentSkills 导入
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.1.0
 * @created: 2026-06-03
 * @updated: 2026-07-25
 * @status: deprecated
 * @tags: agent,skills,deprecated
 */

export {
  AgentSkillsEngine,
  matchSkillByKeywords,
  getAgentSkillsEngine,
  resetAgentSkillsEngine,
} from "./services/agent/AgentSkills";
export type {
  FamilyRole,
  AgentBinding,
  AgentSkillResult,
} from "./services/agent/AgentSkills";
export { default } from "./services/agent/AgentSkills";
