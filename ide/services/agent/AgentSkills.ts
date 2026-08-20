/**
 * @file: AgentSkills.ts
 * @description: YYC³ AI Family Agent Skills 引擎 — Skill加载、意图路由、Agent执行一体化
 *               遵循 Agent Skills 开放标准，三级渐进式加载，8家人角色按需激活
 *               技能定义源自企业蓝图AgentSkills.ts，严格对齐1201-1205五大维度
 *               — 已解耦外部白皮书依赖，使用本地 agent/ 目录下的类型和数据
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.1.0
 * @created: 2026-06-03
 * @updated: 2026-07-25
 * @license: MIT
 * @tags: agent,skills,routing,execution,ai-family,blueprint
 */

import {
  ALL_AGENT_SKILLS,
  getAgentAllSkills,
  getAgentPromptTemplate,
  getAgentSkills,
  getSkillStats,
} from "./blueprintData";
import type {
  AgentSkill,
  AgentSkillProfile,
  ChatMessage,
  ProviderConfig,
  StreamCallbacks,
} from "./types";
import { logger } from "../logger";
import {
  AI_FAMILY_SKILLS,
  matchSkillByKeywords
} from "./skillsData";
import {
  chatCompletionStream,
  getProviderConfig,
} from "./llmService";

// ================================================================
// Agent Skill 角色类型 — 8家人
// ================================================================

export type FamilyRole =
  | "tianshu"    // 元启·天枢 — 总指挥
  | "qianhang"   // 言启·千行 — 导航员
  | "wanwu"      // 语枢·万物 — 思考者
  | "xianzhi"    // 预见·先知 — 预言家
  | "bole"       // 知遇·伯乐 — 推荐官
  | "shouhu"     // 智云·守护 — 安全官
  | "zongshi"    // 格物·宗师 — 质量官
  | "lingyun";   // 创想·灵韵 — 创意官

/** 蓝图AgentId → FamilyRole 映射 */
const BLUEPRINT_TO_ROLE: Record<string, FamilyRole> = {
  "meta-oracle": "tianshu",
  "navigator": "qianhang",
  "thinker": "wanwu",
  "prophet": "xianzhi",
  "bolero": "bole",
  "sentinel": "shouhu",
  "master": "zongshi",
  "creative": "lingyun",
};

/** FamilyRole → 蓝图AgentId 反向映射 */
const ROLE_TO_BLUEPRINT: Record<FamilyRole, string> = {
  tianshu: "meta-oracle",
  qianhang: "navigator",
  wanwu: "thinker",
  xianzhi: "prophet",
  bole: "bolero",
  shouhu: "sentinel",
  zongshi: "master",
  lingyun: "creative",
};

// ================================================================
// Provider × Agent × Skill 绑定矩阵
// ================================================================

export interface AgentBinding {
  role: FamilyRole;
  familyName: string;
  phone: string;
  providerId: string;
  modelId: string;
  lora?: string;
  skillName: string;
  blueprintAgentId: string;
  temperature: number;
  maxTokens: number;
}

const AGENT_BINDINGS: Record<FamilyRole, AgentBinding> = {
  tianshu: {
    role: "tianshu",
    familyName: "元启·天枢",
    phone: "0379-0206",
    providerId: "vllm-n1-27b",
    modelId: "Qwen3.6-27B",
    lora: "yyc3-mgmt-v2",
    skillName: "tianshu-strategy",
    blueprintAgentId: "meta-oracle",
    temperature: 0.3,
    maxTokens: 8192,
  },
  qianhang: {
    role: "qianhang",
    familyName: "言启·千行",
    phone: "0379-0106",
    providerId: "vllm-n1-35b",
    modelId: "Qwen3.6-35B-A3B",
    skillName: "qianhang-navigation",
    blueprintAgentId: "navigator",
    temperature: 0.2,
    maxTokens: 4096,
  },
  wanwu: {
    role: "wanwu",
    familyName: "语枢·万物",
    phone: "0379-0107",
    providerId: "vllm-n1-27b",
    modelId: "Qwen3.6-27B",
    lora: "yyc3-mgmt-v2",
    skillName: "wanwu-analysis",
    blueprintAgentId: "thinker",
    temperature: 0.1,
    maxTokens: 16384,
  },
  xianzhi: {
    role: "xianzhi",
    familyName: "预见·先知",
    phone: "0379-0108",
    providerId: "vllm-n1-27b",
    modelId: "Qwen3.6-27B",
    skillName: "xianzhi-prediction",
    blueprintAgentId: "prophet",
    temperature: 0.3,
    maxTokens: 8192,
  },
  bole: {
    role: "bole",
    familyName: "知遇·伯乐",
    phone: "0379-0109",
    providerId: "tei-n1-embed",
    modelId: "Qwen3-Embedding-8B",
    skillName: "bole-recommendation",
    blueprintAgentId: "bolero",
    temperature: 0.0,
    maxTokens: 4096,
  },
  shouhu: {
    role: "shouhu",
    familyName: "智云·守护",
    phone: "0379-0207",
    providerId: "vllm-n1-27b",
    modelId: "Qwen3.6-27B",
    lora: "yyc3-security-v1",
    skillName: "shouhu-security",
    blueprintAgentId: "sentinel",
    temperature: 0.1,
    maxTokens: 4096,
  },
  zongshi: {
    role: "zongshi",
    familyName: "格物·宗师",
    phone: "0379-0208",
    providerId: "vllm-n1-27b",
    modelId: "Qwen3.6-27B",
    lora: "yyc3-code-v2",
    skillName: "zongshi-quality",
    blueprintAgentId: "master",
    temperature: 0.2,
    maxTokens: 8192,
  },
  lingyun: {
    role: "lingyun",
    familyName: "创想·灵韵",
    phone: "0379-0209",
    providerId: "ollama-n1-coder",
    modelId: "qwen3-coder-30b-a3b",
    skillName: "lingyun-creative",
    blueprintAgentId: "creative",
    temperature: 0.7,
    maxTokens: 8192,
  },
};

// ================================================================
// Agent 执行结果
// ================================================================

export interface AgentSkillResult {
  role: FamilyRole;
  familyName: string;
  skillName: string;
  /** 匹配到的蓝图技能ID */
  blueprintSkillId?: string;
  output: string;
  durationMs: number;
  success: boolean;
  error?: string;
  provider: string;
  model: string;
}

// ================================================================
// AgentSkills 引擎 — 蓝图技能 + IDE执行一体化
// ================================================================

export class AgentSkillsEngine {
  private loadedSkills: Map<string, string> = new Map();
  private executionHistory: AgentSkillResult[] = [];

  /**
   * 意图路由 — 三层匹配：蓝图触发词 → SKILL关键词 → 默认千行
   */
  resolveAgent(userInput: string): AgentBinding {
    // Layer 1: 蓝图版触发词匹配（精确度高）
    for (const profile of ALL_AGENT_SKILLS) {
      for (const skill of profile.skills) {
        const matched = skill.triggers.some(
          (t) => userInput.includes(t)
        );
        if (matched) {
          const role = BLUEPRINT_TO_ROLE[profile.agentId];
          if (role) {
            const binding = AGENT_BINDINGS[role];
            logger.info(
              `[AgentSkills] 蓝图触发词命中 → ${binding.familyName} (${binding.phone}) | skill=${skill.id} | trigger="${skill.triggers.find(t => userInput.includes(t))}"`
            );
            return binding;
          }
        }
      }
    }

    // Layer 2: SKILL.md 关键词匹配
    const matchedSkill = matchSkillByKeywords(userInput);
    if (matchedSkill) {
      const binding = Object.values(AGENT_BINDINGS).find(
        (b) => b.skillName === matchedSkill.name
      );
      if (binding) {
        logger.info(
          `[AgentSkills] SKILL关键词命中 → ${binding.familyName} (${binding.phone})`
        );
        return binding;
      }
    }

    // Layer 3: 默认路由到千行（导航员）
    logger.info("[AgentSkills] 未匹配明确意图，默认路由到言启·千行");
    return AGENT_BINDINGS.qianhang;
  }

  /**
   * 精确匹配蓝图技能 — 返回具体的 AgentSkill
   */
  resolveBlueprintSkill(userInput: string): { role: FamilyRole; skill: AgentSkill } | null {
    for (const profile of ALL_AGENT_SKILLS) {
      for (const skill of profile.skills) {
        if (skill.triggers.some((t) => userInput.includes(t))) {
          const role = BLUEPRINT_TO_ROLE[profile.agentId];
          if (role) return { role, skill };
        }
      }
    }
    return null;
  }

  /**
   * 获取指定角色的绑定配置
   */
  getBinding(role: FamilyRole): AgentBinding {
    return AGENT_BINDINGS[role];
  }

  /**
   * 获取所有角色绑定
   */
  getAllBindings(): AgentBinding[] {
    return Object.values(AGENT_BINDINGS);
  }

  /**
   * 获取蓝图版技能档案（完整技能定义）
   */
  getBlueprintProfile(role: FamilyRole): AgentSkillProfile | undefined {
    const blueprintId = ROLE_TO_BLUEPRINT[role];
    return getAgentSkills(blueprintId);
  }

  /**
   * 获取蓝图版System Prompt模板（含五维方法论+角色定位）
   */
  getBlueprintPrompt(role: FamilyRole): string {
    const blueprintId = ROLE_TO_BLUEPRINT[role];
    return getAgentPromptTemplate(blueprintId);
  }

  /**
   * 获取蓝图版全部技能列表
   */
  getBlueprintAllSkills(role: FamilyRole): AgentSkill[] {
    const blueprintId = ROLE_TO_BLUEPRINT[role];
    return getAgentAllSkills(blueprintId);
  }

  /**
   * 获取蓝图统计信息
   */
  getBlueprintStats() {
    return getSkillStats();
  }

  /**
   * 解析 Provider 配置
   */
  resolveProvider(binding: AgentBinding): ProviderConfig | null {
    const config = getProviderConfig(binding.providerId);
    return config || null;
  }

  /**
   * 构建完整System Prompt — 蓝图模板 + 具体技能步骤
   */
  private buildSystemPrompt(
    binding: AgentBinding,
    matchedSkill?: AgentSkill
  ): string {
    // 基础：蓝图版完整System Prompt（含角色定位、方法论、安全护栏）
    const blueprintPrompt = this.getBlueprintPrompt(binding.role);

    let prompt = blueprintPrompt;

    // 如果匹配到具体蓝图技能，注入执行步骤和输出格式
    if (matchedSkill) {
      prompt += `

【当前任务技能: ${matchedSkill.name}】
蓝图文档: ${matchedSkill.blueprintRef}
技能描述: ${matchedSkill.description}
执行步骤:
${matchedSkill.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}
期望输出格式: ${matchedSkill.outputFormat}
协同Agent: ${matchedSkill.collaborators.join(", ")}`;
    }

    return prompt;
  }

  /**
   * 执行单个Agent — 加载蓝图Skill + 调用vLLM
   */
  async executeAgent(
    role: FamilyRole,
    userMessage: string,
    callbacks?: Partial<StreamCallbacks>,
    contextMessages?: ChatMessage[]
  ): Promise<AgentSkillResult> {
    const binding = AGENT_BINDINGS[role];
    const provider = this.resolveProvider(binding);
    const startTime = Date.now();

    // 尝试匹配具体蓝图技能
    const blueprintMatch = this.resolveBlueprintSkill(userMessage);
    const matchedSkill = blueprintMatch?.role === role ? blueprintMatch.skill : undefined;

    if (!provider) {
      const result: AgentSkillResult = {
        role,
        familyName: binding.familyName,
        skillName: binding.skillName,
        blueprintSkillId: matchedSkill?.id,
        output: "",
        durationMs: Date.now() - startTime,
        success: false,
        error: `Provider ${binding.providerId} 不可用 — 请检查 vLLM 服务是否启动`,
        provider: binding.providerId,
        model: binding.modelId,
      };
      this.executionHistory.push(result);
      return result;
    }

    // 构建 messages: 蓝图system prompt + context + user message
    const messages: ChatMessage[] = [];

    // 使用蓝图版完整System Prompt（含技能步骤）
    const systemPrompt = this.buildSystemPrompt(binding, matchedSkill);
    messages.push({ role: "system", content: systemPrompt });

    // 附加上下文消息
    if (contextMessages && contextMessages.length > 0) {
      messages.push(...contextMessages);
    }

    // 用户消息
    messages.push({ role: "user", content: userMessage });

    // 执行流式调用
    let output = "";

    try {
      await new Promise<void>((resolve, reject) => {
        chatCompletionStream(
          provider,
          binding.modelId,
          messages,
          {
            onToken: (token) => {
              output += token;
              callbacks?.onToken?.(token);
            },
            onDone: (fullText) => {
              output = fullText;
              callbacks?.onDone?.(fullText);
              resolve();
            },
            onError: (error) => {
              callbacks?.onError?.(error);
              reject(new Error(error));
            },
          },
          {
            temperature: binding.temperature,
            maxTokens: binding.maxTokens,
          }
        );
      });

      const result: AgentSkillResult = {
        role,
        familyName: binding.familyName,
        skillName: binding.skillName,
        blueprintSkillId: matchedSkill?.id,
        output,
        durationMs: Date.now() - startTime,
        success: true,
        provider: binding.providerId,
        model: binding.modelId,
      };

      this.executionHistory.push(result);
      logger.info(
        `[AgentSkills] ${binding.familyName} 执行完成 | ${result.durationMs}ms | ${output.length} chars | skill=${matchedSkill?.id || "通用"}`
      );
      return result;
    } catch (err: any) {
      const result: AgentSkillResult = {
        role,
        familyName: binding.familyName,
        skillName: binding.skillName,
        blueprintSkillId: matchedSkill?.id,
        output,
        durationMs: Date.now() - startTime,
        success: false,
        error: err.message || "执行失败",
        provider: binding.providerId,
        model: binding.modelId,
      };

      this.executionHistory.push(result);
      logger.error(`[AgentSkills] ${binding.familyName} 执行失败:`, err);
      return result;
    }
  }

  /**
   * 天枢编排 — 多Agent协同流水线
   * 天枢分解任务 → 千行路由 → 主Agent执行 → 守护安全审查
   */
  async orchestrate(
    userRequest: string,
    callbacks?: Partial<StreamCallbacks>
  ): Promise<AgentSkillResult[]> {
    const results: AgentSkillResult[] = [];

    // Step 1: 天枢分析意图并分解任务
    const tianshuResult = await this.executeAgent(
      "tianshu",
      `分析以下用户需求，判断需要调用哪些Agent，给出执行计划：\n\n${userRequest}`,
      callbacks
    );
    results.push(tianshuResult);

    if (!tianshuResult.success) {
      return results;
    }

    // Step 2: 千行路由 — 根据天枢分析结果，路由到主执行Agent
    const mainAgent = this.resolveAgent(userRequest);

    // 跳过天枢自身，避免重复
    if (mainAgent.role !== "tianshu") {
      const mainResult = await this.executeAgent(
        mainAgent.role,
        userRequest,
        callbacks,
        [{ role: "assistant", content: tianshuResult.output }]
      );
      results.push(mainResult);

      // Step 3: 自动附加安全审查 (守护)
      if (mainResult.success && mainAgent.role !== "shouhu") {
        const securityResult = await this.executeAgent(
          "shouhu",
          `请审查以下输出是否安全合规：\n\n${mainResult.output.slice(0, 2000)}`,
          undefined,
          [{ role: "assistant", content: mainResult.output }]
        );
        results.push(securityResult);
      }
    }

    return results;
  }

  /**
   * 获取执行历史
   */
  getHistory(): AgentSkillResult[] {
    return [...this.executionHistory];
  }

  /**
   * 清除执行历史
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * 获取所有Skill元数据 (L1) — SKILL.md版本
   */
  getAllSkillMetadata() {
    return AI_FAMILY_SKILLS.map((s) => ({
      name: s.name,
      description: s.description,
      familyMember: s.familyMember,
      phone: s.phone,
      model: s.model,
    }));
  }

  /**
   * 获取完整蓝图技能矩阵 — 蓝图版本
   */
  getFullBlueprint() {
    return ALL_AGENT_SKILLS;
  }
}

// ── 单例 ──

let engineInstance: AgentSkillsEngine | null = null;

export function getAgentSkillsEngine(): AgentSkillsEngine {
  if (!engineInstance) {
    engineInstance = new AgentSkillsEngine();
    const stats = getSkillStats();
    logger.info(
      `[AgentSkills] 引擎初始化完成 — 8个家人就绪 | 蓝图技能总数: ${stats.totalSkills} | 维度: ${Object.keys(stats.byCategory).length}类`
    );
  }
  return engineInstance;
}

export function resetAgentSkillsEngine(): void {
  engineInstance = null;
}

export { matchSkillByKeywords };

export default AgentSkillsEngine;
