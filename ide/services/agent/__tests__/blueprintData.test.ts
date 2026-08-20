/**
 * @file: services/agent/__tests__/blueprintData.test.ts
 * @description: 蓝图数据模块单元测试
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [test],[agent],[blueprint],[unit]
 *
 * brief: 测试蓝图数据和工具函数
 *
 * details:
 * - 测试默认蓝图数据完整性
 * - 测试 getSkillStats 统计
 * - 测试 getAgentSkills / getAgentAllSkills 查询
 * - 测试 registerBlueprintData 注入机制
 *
 * test-target: services/agent/blueprintData.ts
 * coverage: 90%+
 * notes: 使用 Vitest
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_BLUEPRINT_DATA,
  getBlueprintData,
  getSkillStats,
  getAgentSkills,
  getAgentAllSkills,
  getAgentPromptTemplate,
  registerBlueprintData,
  ALL_AGENT_SKILLS,
} from "../blueprintData";
import type { AgentSkillProfile } from "../types";

describe("Blueprint Data", () => {
  beforeEach(() => {
    // 重置为默认数据
    registerBlueprintData(DEFAULT_BLUEPRINT_DATA);
  });

  describe("默认数据完整性", () => {
    it("应包含 8 个 Agent 配置", () => {
      expect(DEFAULT_BLUEPRINT_DATA.length).toBe(8);
    });

    it("每个 Agent 应有必要字段", () => {
      for (const profile of DEFAULT_BLUEPRINT_DATA) {
        expect(profile).toHaveProperty("agentId");
        expect(profile).toHaveProperty("name");
        expect(profile).toHaveProperty("role");
        expect(profile).toHaveProperty("description");
        expect(profile).toHaveProperty("skills");
        expect(Array.isArray(profile.skills)).toBe(true);
        expect(profile.skills.length).toBeGreaterThan(0);
      }
    });

    it("每个技能应有必要字段", () => {
      for (const profile of DEFAULT_BLUEPRINT_DATA) {
        for (const skill of profile.skills) {
          expect(skill).toHaveProperty("id");
          expect(skill).toHaveProperty("name");
          expect(skill).toHaveProperty("description");
          expect(skill).toHaveProperty("triggers");
          expect(skill).toHaveProperty("steps");
          expect(skill).toHaveProperty("outputFormat");
          expect(skill).toHaveProperty("collaborators");
          expect(Array.isArray(skill.triggers)).toBe(true);
          expect(Array.isArray(skill.steps)).toBe(true);
          expect(Array.isArray(skill.collaborators)).toBe(true);
        }
      }
    });

    it("ALL_AGENT_SKILLS 应与默认数据一致", () => {
      expect(ALL_AGENT_SKILLS.length).toBe(DEFAULT_BLUEPRINT_DATA.length);
    });
  });

  describe("getSkillStats", () => {
    it("应返回正确的统计数据", () => {
      const stats = getSkillStats();
      expect(stats).toHaveProperty("totalAgents");
      expect(stats).toHaveProperty("totalSkills");
      expect(stats).toHaveProperty("byCategory");
      expect(stats.totalAgents).toBe(8);
      expect(stats.totalSkills).toBe(8); // 每个Agent 1个技能
      expect(typeof stats.byCategory).toBe("object");
    });

    it("分类统计应正确汇总", () => {
      const stats = getSkillStats();
      const categoryCount = Object.values(stats.byCategory).reduce(
        (sum, count) => sum + count,
        0
      );
      expect(categoryCount).toBe(stats.totalSkills);
    });
  });

  describe("getAgentSkills", () => {
    it("应根据 agentId 返回正确的配置", () => {
      const result = getAgentSkills("meta-oracle");
      expect(result).not.toBeUndefined();
      expect(result?.agentId).toBe("meta-oracle");
      expect(result?.name).toBe("元启·天枢");
    });

    it("不存在的 agentId 应返回 undefined", () => {
      const result = getAgentSkills("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("getAgentAllSkills", () => {
    it("应返回指定 Agent 的所有技能", () => {
      const skills = getAgentAllSkills("thinker");
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
    });

    it("不存在的 agentId 应返回空数组", () => {
      const skills = getAgentAllSkills("non-existent");
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBe(0);
    });
  });

  describe("getAgentPromptTemplate", () => {
    it("应返回指定 Agent 的提示词模板", () => {
      const template = getAgentPromptTemplate("meta-oracle");
      expect(typeof template).toBe("string");
      expect(template.length).toBeGreaterThan(0);
    });

    it("不存在的 agentId 应返回空字符串", () => {
      const template = getAgentPromptTemplate("non-existent");
      expect(template).toBe("");
    });
  });

  describe("registerBlueprintData", () => {
    it("应能注册自定义蓝图数据", () => {
      const customData: AgentSkillProfile[] = [
        {
          agentId: "custom-agent",
          name: "自定义Agent",
          role: "测试",
          description: "测试用",
          skills: [
            {
              id: "test-skill",
              name: "测试技能",
              description: "测试",
              triggers: ["测试"],
              steps: ["步骤1"],
              outputFormat: "文本",
              collaborators: [],
              category: "test",
            },
          ],
        },
      ];

      registerBlueprintData(customData);
      const data = getBlueprintData();
      expect(data.length).toBe(1);
      expect(data[0].agentId).toBe("custom-agent");
    });

    it("注册后 getSkillStats 应反映新数据", () => {
      const customData: AgentSkillProfile[] = [
        {
          agentId: "test",
          name: "测试",
          role: "测试",
          description: "测试",
          skills: [
            {
              id: "s1",
              name: "技能1",
              description: "1",
              triggers: ["t1"],
              steps: ["s1"],
              outputFormat: "f1",
              collaborators: [],
              category: "cat1",
            },
            {
              id: "s2",
              name: "技能2",
              description: "2",
              triggers: ["t2"],
              steps: ["s2"],
              outputFormat: "f2",
              collaborators: [],
              category: "cat2",
            },
          ],
        },
      ];

      registerBlueprintData(customData);
      const stats = getSkillStats();
      expect(stats.totalAgents).toBe(1);
      expect(stats.totalSkills).toBe(2);
      expect(stats.byCategory["cat1"]).toBe(1);
      expect(stats.byCategory["cat2"]).toBe(1);
    });
  });
});
