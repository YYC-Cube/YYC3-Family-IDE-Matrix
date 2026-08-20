/**
 * @file: agent/types.ts
 * @description: Agent Skills 本地类型定义 — 解耦外部白皮书依赖
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [type],[agent],[skills]
 *
 * brief: Agent Skills 核心类型定义
 *
 * details:
 * - 从白皮书目录解耦，本地维护类型定义
 * - 与蓝图 AgentSkills.ts 保持结构兼容
 * - 支持运行时注入外部蓝图数据
 *
 * dependencies: 无
 * exports: AgentSkill, AgentSkillProfile, ChatMessage, ProviderConfig, StreamCallbacks
 */

// ================================================================
// Agent Skill 类型（与蓝图版本兼容）
// ================================================================

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  steps: string[];
  outputFormat: string;
  collaborators: string[];
  blueprintRef?: string;
  category?: string;
}

export interface AgentSkillProfile {
  agentId: string;
  name: string;
  role: string;
  description: string;
  skills: AgentSkill[];
  promptTemplate?: string;
}

// ================================================================
// LLM Service 类型
// ================================================================

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  apiKey?: string;
  type: "openai" | "ollama" | "custom";
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: string) => void;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

// ================================================================
// Skill Stats
// ================================================================

export interface SkillStats {
  totalAgents: number;
  totalSkills: number;
  byCategory: Record<string, number>;
}
