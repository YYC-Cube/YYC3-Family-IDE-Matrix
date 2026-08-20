/**
 * @file: agent.ts
 * @description: Agent 域共享类型 — 角色枚举单点定义（审计 Q4 收敛）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [agent],[types]
 *
 * details: 原本三处独立定义（useMemoryStore/useMultiAgentDispatch/MultiAgentPanel），
 *          角色增删必漂移；现收敛至此，消费方 re-export 保持 API 兼容
 */

/** 多 Agent 流水线角色 */
export type AgentRole = "planner" | "coder" | "tester" | "reviewer";
