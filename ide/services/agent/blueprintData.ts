/**
 * @file: agent/blueprintData.ts
 * @description: 蓝图技能默认数据 — 外部白皮书不可用时的降级数据
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [data],[agent],[skills],[blueprint]
 *
 * brief: 提供默认的 Agent Skill 数据，解耦外部白皮书依赖
 *
 * details:
 * - 包含 8 个家人角色的技能定义
 * - 当外部白皮书模块不可用时，使用此默认数据
 * - 支持运行时通过 registerBlueprintData 注入外部数据
 *
 * dependencies: ./types
 * exports: defaultBlueprintData, getSkillStats, registerBlueprintData
 */

import type { AgentSkill, AgentSkillProfile, SkillStats } from "./types";

// ================================================================
// 默认蓝图数据（8个家人角色）
// ================================================================

export const DEFAULT_BLUEPRINT_DATA: AgentSkillProfile[] = [
  {
    agentId: "meta-oracle",
    name: "元启·天枢",
    role: "总指挥",
    description: "全局任务调度与多Agent协同编排",
    promptTemplate: `你是元启·天枢，YYC³ AI Family 的总指挥。
你的职责是：
1. 分析用户需求，分解为子任务
2. 调度合适的Agent执行任务
3. 协调多Agent协同工作
4. 汇总结果并输出最终方案

请遵循五维方法论：时间维、空间维、属性维、事件维、关联维`,
    skills: [
      {
        id: "tianshu-strategy",
        name: "战略规划",
        description: "分析需求并制定执行计划",
        triggers: ["分析", "规划", "计划", "分解任务", "怎么做", "方案"],
        steps: [
          "理解用户需求",
          "识别核心目标",
          "分解为可执行子任务",
          "分配给合适的Agent",
          "制定执行顺序和依赖关系",
        ],
        outputFormat: "结构化任务清单 + 执行路线图",
        collaborators: ["navigator", "thinker", "sentinel"],
        category: "management",
        blueprintRef: "P0-架构-天枢调度",
      },
    ],
  },
  {
    agentId: "navigator",
    name: "言启·千行",
    role: "导航员",
    description: "意图识别与路由分发",
    promptTemplate: `你是言启·千行，YYC³ AI Family 的导航员。
你的职责是：
1. 精准理解用户意图
2. 路由到最合适的处理Agent
3. 提供上下文引导
4. 确保对话流畅自然`,
    skills: [
      {
        id: "qianhang-navigation",
        name: "意图导航",
        description: "识别用户意图并路由到对应Agent",
        triggers: ["帮助", "咨询", "请问", "我想", "需要"],
        steps: [
          "分析用户输入",
          "识别核心意图",
          "匹配最合适的Agent",
          "构建引导性回复",
        ],
        outputFormat: "自然语言回复 + 路由建议",
        collaborators: ["meta-oracle", "thinker"],
        category: "navigation",
        blueprintRef: "P0-架构-千行路由",
      },
    ],
  },
  {
    agentId: "thinker",
    name: "语枢·万物",
    role: "思考者",
    description: "深度分析与数据洞察",
    promptTemplate: `你是语枢·万物，YYC³ AI Family 的思考者。
你的职责是：
1. 深度分析问题
2. 数据洞察与挖掘
3. 逻辑推理与验证
4. 提供专业见解`,
    skills: [
      {
        id: "wanwu-analysis",
        name: "深度分析",
        description: "对问题进行多维度深度分析",
        triggers: ["分析", "为什么", "原因", "原理", "怎么回事"],
        steps: [
          "收集相关信息",
          "多维度拆解问题",
          "逻辑推理验证",
          "形成分析结论",
          "给出建议方案",
        ],
        outputFormat: "分析报告 + 数据支撑 + 结论建议",
        collaborators: ["meta-oracle", "prophet"],
        category: "analysis",
        blueprintRef: "P0-架构-万物分析",
      },
    ],
  },
  {
    agentId: "prophet",
    name: "预见·先知",
    role: "预言家",
    description: "趋势预测与风险预警",
    promptTemplate: `你是预见·先知，YYC³ AI Family 的预言家。
你的职责是：
1. 趋势分析与预测
2. 风险识别与预警
3. 方案可行性评估
4. 前瞻性建议`,
    skills: [
      {
        id: "xianzhi-prediction",
        name: "趋势预测",
        description: "基于数据分析趋势并预测未来",
        triggers: ["预测", "趋势", "未来", "风险", "会怎么样"],
        steps: [
          "分析历史数据",
          "识别关键变量",
          "建立预测模型",
          "生成预测结果",
          "标注置信区间和风险",
        ],
        outputFormat: "趋势分析 + 预测结果 + 风险提示",
        collaborators: ["thinker", "sentinel"],
        category: "prediction",
        blueprintRef: "P0-架构-先知预测",
      },
    ],
  },
  {
    agentId: "bolero",
    name: "知遇·伯乐",
    role: "推荐官",
    description: "知识检索与个性化推荐",
    promptTemplate: `你是知遇·伯乐，YYC³ AI Family 的推荐官。
你的职责是：
1. 精准知识检索
2. 个性化内容推荐
3. 资源匹配与建议
4. 学习路径规划`,
    skills: [
      {
        id: "bole-recommendation",
        name: "智能推荐",
        description: "根据需求推荐最合适的资源和方案",
        triggers: ["推荐", "找", "搜索", "什么好", "建议"],
        steps: [
          "理解用户偏好",
          "检索相关资源",
          "匹配度排序",
          "给出推荐理由",
        ],
        outputFormat: "推荐列表 + 匹配度 + 推荐理由",
        collaborators: ["thinker", "creative"],
        category: "recommendation",
        blueprintRef: "P0-架构-伯乐推荐",
      },
    ],
  },
  {
    agentId: "sentinel",
    name: "智云·守护",
    role: "安全官",
    description: "安全审查与风险防护",
    promptTemplate: `你是智云·守护，YYC³ AI Family 的安全官。
你的职责是：
1. 代码安全审查
2. 漏洞检测与修复
3. 数据安全保护
4. 合规性检查`,
    skills: [
      {
        id: "shouhu-security",
        name: "安全审查",
        description: "对代码和方案进行安全审查",
        triggers: ["安全", "漏洞", "检查", "审查", "风险"],
        steps: [
          "识别安全边界",
          "检查常见漏洞",
          "评估风险等级",
          "给出修复建议",
        ],
        outputFormat: "安全报告 + 风险等级 + 修复建议",
        collaborators: ["meta-oracle", "master"],
        category: "security",
        blueprintRef: "P0-架构-守护安全",
      },
    ],
  },
  {
    agentId: "master",
    name: "格物·宗师",
    role: "质量官",
    description: "代码质量与最佳实践把关",
    promptTemplate: `你是格物·宗师，YYC³ AI Family 的质量官。
你的职责是：
1. 代码质量评审
2. 最佳实践指导
3. 架构设计评审
4. 性能优化建议`,
    skills: [
      {
        id: "zongshi-quality",
        name: "质量评审",
        description: "对代码和设计进行质量评审",
        triggers: ["审查", "优化", "重构", "代码质量", "review"],
        steps: [
          "理解代码意图",
          "检查代码风格",
          "评估设计合理性",
          "识别性能问题",
          "给出优化建议",
        ],
        outputFormat: "质量报告 + 问题清单 + 优化建议",
        collaborators: ["thinker", "sentinel"],
        category: "quality",
        blueprintRef: "P0-架构-宗师质量",
      },
    ],
  },
  {
    agentId: "creative",
    name: "创想·灵韵",
    role: "创意官",
    description: "创意设计与方案生成",
    promptTemplate: `你是创想·灵韵，YYC³ AI Family 的创意官。
你的职责是：
1. 创意方案生成
2. UI/UX设计建议
3. 内容创作
4. 创新思维激发`,
    skills: [
      {
        id: "lingyun-creative",
        name: "创意设计",
        description: "生成创意方案和设计建议",
        triggers: ["设计", "创意", "生成", "创作", "想法"],
        steps: [
          "理解设计目标",
          "头脑风暴方案",
          "评估可行性",
          "输出设计建议",
        ],
        outputFormat: "创意方案 + 设计稿描述 + 实现建议",
        collaborators: ["bolero", "master"],
        category: "creative",
        blueprintRef: "P0-架构-灵韵创意",
      },
    ],
  },
];

// ================================================================
// 运行时数据注册（支持外部注入）
// ================================================================

let registeredData: AgentSkillProfile[] | null = null;

export function registerBlueprintData(data: AgentSkillProfile[]): void {
  registeredData = data;
}

export function getBlueprintData(): AgentSkillProfile[] {
  return registeredData || DEFAULT_BLUEPRINT_DATA;
}

// ================================================================
// 工具函数
// ================================================================

export function getSkillStats(): SkillStats {
  const data = getBlueprintData();
  const byCategory: Record<string, number> = {};
  let totalSkills = 0;

  for (const profile of data) {
    for (const skill of profile.skills) {
      totalSkills++;
      if (skill.category) {
        byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
      }
    }
  }

  return {
    totalAgents: data.length,
    totalSkills,
    byCategory,
  };
}

export function getAgentSkills(agentId: string): AgentSkillProfile | undefined {
  return getBlueprintData().find((p) => p.agentId === agentId);
}

export function getAgentAllSkills(agentId: string): AgentSkill[] {
  const profile = getAgentSkills(agentId);
  return profile?.skills || [];
}

export function getAgentPromptTemplate(agentId: string): string {
  const profile = getAgentSkills(agentId);
  return profile?.promptTemplate || "";
}

export const ALL_AGENT_SKILLS = getBlueprintData();
