/**
 * @file: agent/skillsData.ts
 * @description: AI Family 技能关键词数据 — 用于二级意图匹配
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [data],[skills],[ai-family]
 *
 * brief: AI Family 技能关键词匹配数据
 *
 * details:
 * - 定义每个家人角色的关键词触发模式
 * - 支持基于关键词的意图路由（二级匹配）
 * - 与蓝图技能保持对应关系
 *
 * dependencies: ./types
 * exports: AI_FAMILY_SKILLS, matchSkillByKeywords
 */

import type { AgentSkill } from "./types";

export interface FamilySkill {
  name: string;
  description: string;
  familyMember: string;
  phone: string;
  model: string;
  keywords: string[];
  category: string;
}

export const AI_FAMILY_SKILLS: FamilySkill[] = [
  {
    name: "tianshu-strategy",
    description: "战略规划与任务分解",
    familyMember: "元启·天枢",
    phone: "0379-0206",
    model: "Qwen3.6-27B",
    category: "management",
    keywords: ["规划", "分解", "安排", "计划", "方案", "统筹", "调度", "怎么做"],
  },
  {
    name: "qianhang-navigation",
    description: "意图导航与咨询引导",
    familyMember: "言启·千行",
    phone: "0379-0106",
    model: "Qwen3.6-35B-A3B",
    category: "navigation",
    keywords: ["帮助", "咨询", "请问", "我想", "需要", "怎么", "如何"],
  },
  {
    name: "wanwu-analysis",
    description: "深度分析与数据洞察",
    familyMember: "语枢·万物",
    phone: "0379-0107",
    model: "Qwen3.6-27B",
    category: "analysis",
    keywords: ["分析", "原因", "原理", "为什么", "怎么回事", "洞察"],
  },
  {
    name: "xianzhi-prediction",
    description: "趋势预测与风险评估",
    familyMember: "预见·先知",
    phone: "0379-0108",
    model: "Qwen3.6-27B",
    category: "prediction",
    keywords: ["预测", "趋势", "未来", "风险", "会不会", "可能"],
  },
  {
    name: "bole-recommendation",
    description: "智能推荐与知识检索",
    familyMember: "知遇·伯乐",
    phone: "0379-0109",
    model: "Qwen3-Embedding-8B",
    category: "recommendation",
    keywords: ["推荐", "找", "搜索", "什么好", "建议", "选哪个"],
  },
  {
    name: "shouhu-security",
    description: "安全审查与漏洞检测",
    familyMember: "智云·守护",
    phone: "0379-0207",
    model: "Qwen3.6-27B",
    category: "security",
    keywords: ["安全", "漏洞", "检查", "审查", "防护", "加密"],
  },
  {
    name: "zongshi-quality",
    description: "代码质量与最佳实践",
    familyMember: "格物·宗师",
    phone: "0379-0208",
    model: "Qwen3.6-27B",
    category: "quality",
    keywords: ["优化", "重构", "review", "代码质量", "最佳实践", "改进"],
  },
  {
    name: "lingyun-creative",
    description: "创意设计与内容生成",
    familyMember: "创想·灵韵",
    phone: "0379-0209",
    model: "qwen3-coder-30b-a3b",
    category: "creative",
    keywords: ["设计", "创意", "生成", "创作", "想法", "灵感"],
  },
];

/**
 * 通过关键词匹配技能
 * @param input 用户输入文本
 * @returns 匹配到的技能，未匹配返回 null
 *
 * 算法升级 (J-修复):
 *  - 每个 skill 的第一个关键词 (category 核心词) 权重 = +2 (更具特异性)
 *  - 其余关键词权重 = +1
 *  - 同分时取权重得分更高者；仍相同时按数组顺序稳定取先出现者
 *  这样 "推荐一个好的方案" → "推荐"(bole 核心词 +2) > "方案"(tianshu 普通词 +1) → 命中知遇·伯乐
 */
export function matchSkillByKeywords(input: string): FamilySkill | null {
  if (!input || input.trim().length === 0) {
    return null;
  }

  const lowerInput = input.toLowerCase();
  let bestMatch: FamilySkill | null = null;
  let highestScore = 0;

  for (const skill of AI_FAMILY_SKILLS) {
    let score = 0;
    skill.keywords.forEach((keyword, idx) => {
      if (lowerInput.includes(keyword.toLowerCase())) {
        // J-修复: 每个技能的第 0 个关键词 (该分类核心意图词) 权重加倍至 2
        score += idx === 0 ? 2 : 1;
      }
    });
    if (score > highestScore) {
      highestScore = score;
      bestMatch = skill;
    }
  }

  return highestScore > 0 ? bestMatch : null;
}
