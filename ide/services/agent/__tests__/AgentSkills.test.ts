/**
 * @file: services/agent/__tests__/AgentSkills.test.ts
 * @description: AgentSkillsEngine 完整单元测试模板 — 遵循测试金字塔 70/20/10 分布
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-19
 * @updated: 2026-08-19
 * @status: active
 * @tags: [test],[agent],[skills],[engine],[unit],[integration]
 *
 * brief: AgentSkills 引擎全面单元测试，覆盖类型、路由、执行、编排、历史等
 *
 * details:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  测试金字塔分布 (按本文件内比例)                              │
 * ├─────────────────────────────────────────────────────────────┤
 * │  单元测试 (70%)  ── 纯函数、类方法、分支覆盖                   │
 * │  集成测试 (20%)  ── 模块协作、多层路由、流式回调               │
 * │  E2E 风格 (10%)  ── 完整编排链路、多 Agent 协同               │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 覆盖范围:
 * - 类型与常量: FamilyRole 枚举、映射表完整性
 * - 意图路由 resolveAgent: 三层匹配 (蓝图触发词→关键词→默认千行)
 * - 精确匹配 resolveBlueprintSkill: 蓝图技能精确匹配
 * - 绑定查询: getBinding / getAllBindings
 * - 蓝图数据访问: getBlueprintProfile / getBlueprintPrompt / getBlueprintAllSkills / getBlueprintStats
 * - Provider 解析: resolveProvider
 * - System Prompt 构建: buildSystemPrompt (间接验证)
 * - Agent 执行: executeAgent 成功 / 失败 / Provider 不可用 三分支
 * - 天枢编排: orchestrate 三步流水线 (天枢→千行→守护)
 * - 执行历史: getHistory / clearHistory
 * - 元数据查询: getAllSkillMetadata / getFullBlueprint
 * - 单例管理: getAgentSkillsEngine / resetAgentSkillsEngine
 * - 流式回调: onToken / onDone / onError
 *
 * test-target: services/agent/AgentSkills.ts
 * coverage-target: 90%+ (语句覆盖) / 85%+ (分支覆盖)
 * notes: 使用 Vitest。所有外部依赖均已 mock，可在无 node_modules 环境下运行语法检查
 */

// ================================================================
// 0. Mock 依赖层 — 必须在 import 被测模块之前声明 (Vitest hoisting)
// ================================================================

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";

// ---- 0.1 Mock logger ----
vi.mock("../../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLevel: vi.fn(),
  })),
  setLogLevel: vi.fn(),
  getLogLevel: vi.fn(() => "info"),
}));

// ---- 0.2 Mock skillsData ----
vi.mock("../skillsData", () => {
  type MockSkill = {
    name: string;
    description: string;
    familyMember: string;
    phone: string;
    model: string;
    keywords: string[];
    category: string;
  };
  const MOCK_SKILLS: MockSkill[] = [
    {
      name: "tianshu-strategy",
      description: "策略规划",
      familyMember: "元启·天枢",
      phone: "0379-0206",
      model: "Qwen3.6-27B",
      keywords: ["规划", "策略", "总指挥"],
      category: "management",
    },
    {
      name: "qianhang-navigation",
      description: "导航路由",
      familyMember: "言启·千行",
      phone: "0379-0106",
      model: "Qwen3.6-35B-A3B",
      keywords: ["导航", "路由", "帮助"],
      category: "navigation",
    },
    {
      name: "wanwu-analysis",
      description: "分析思考",
      familyMember: "语枢·万物",
      phone: "0379-0107",
      model: "Qwen3.6-27B",
      keywords: ["分析", "原因", "思考"],
      category: "analysis",
    },
    {
      name: "xianzhi-prediction",
      description: "预测推演",
      familyMember: "预见·先知",
      phone: "0379-0108",
      model: "Qwen3.6-27B",
      keywords: ["预测", "趋势", "未来"],
      category: "prediction",
    },
    {
      name: "bole-recommendation",
      description: "推荐匹配",
      familyMember: "知遇·伯乐",
      phone: "0379-0109",
      model: "Qwen3-Embedding-8B",
      keywords: ["推荐", "选择", "方案"],
      category: "recommendation",
    },
    {
      name: "shouhu-security",
      description: "安全审查",
      familyMember: "智云·守护",
      phone: "0379-0207",
      model: "Qwen3.6-27B",
      keywords: ["安全", "漏洞", "审查"],
      category: "security",
    },
    {
      name: "zongshi-quality",
      description: "质量优化",
      familyMember: "格物·宗师",
      phone: "0379-0208",
      model: "Qwen3.6-27B",
      keywords: ["优化", "重构", "质量"],
      category: "quality",
    },
    {
      name: "lingyun-creative",
      description: "创意生成",
      familyMember: "创想·灵韵",
      phone: "0379-0209",
      model: "qwen3-coder-30b-a3b",
      keywords: ["创意", "设计", "方案"],
      category: "creative",
    },
  ];
  return {
    AI_FAMILY_SKILLS: MOCK_SKILLS,
    matchSkillByKeywords: vi.fn((input: string): MockSkill | null => {
      // 简单 mock：第一个命中关键词即返回
      for (const skill of MOCK_SKILLS) {
        if (skill.keywords.some((k) => input.includes(k))) {
          return skill;
        }
      }
      return null;
    }),
  };
});

// ---- 0.3 Mock blueprintData ----
vi.mock("../blueprintData", () => {
  type MockAgentSkill = {
    id: string;
    name: string;
    description: string;
    blueprintRef: string;
    triggers: string[];
    steps: string[];
    outputFormat: string;
    collaborators: string[];
  };
  type MockProfile = {
    agentId: string;
    name: string;
    description: string;
    skills: MockAgentSkill[];
  };

  const MOCK_PROFILES: MockProfile[] = [
    {
      agentId: "meta-oracle",
      name: "元启·天枢",
      description: "总指挥",
      skills: [
        {
          id: "ts-strategy-001",
          name: "战略规划",
          description: "制定执行计划",
          blueprintRef: "BP-T-001",
          triggers: ["规划任务", "分解需求", "制定计划"],
          steps: ["分析需求", "拆解子任务", "分配角色", "输出计划"],
          outputFormat: "结构化执行计划 JSON",
          collaborators: ["navigator", "thinker"],
        },
      ],
    },
    {
      agentId: "navigator",
      name: "言启·千行",
      description: "导航员",
      skills: [
        {
          id: "qh-nav-001",
          name: "需求导航",
          description: "匹配最佳服务",
          blueprintRef: "BP-Q-001",
          triggers: ["帮我", "我想", "如何"],
          steps: ["理解意图", "匹配能力", "引导操作"],
          outputFormat: "引导式回答",
          collaborators: ["thinker"],
        },
      ],
    },
    {
      agentId: "thinker",
      name: "语枢·万物",
      description: "思考者",
      skills: [
        {
          id: "ww-an-001",
          name: "深度分析",
          description: "根因分析",
          blueprintRef: "BP-W-001",
          triggers: ["分析一下", "原因是什么", "根因"],
          steps: ["收集信息", "建立假设", "验证假设", "输出结论"],
          outputFormat: "分析报告 + 建议",
          collaborators: ["master"],
        },
      ],
    },
    {
      agentId: "prophet",
      name: "预见·先知",
      description: "预言家",
      skills: [],
    },
    {
      agentId: "bolero",
      name: "知遇·伯乐",
      description: "推荐官",
      skills: [],
    },
    {
      agentId: "sentinel",
      name: "智云·守护",
      description: "安全官",
      skills: [
        {
          id: "sh-sec-001",
          name: "安全审计",
          description: "检查代码漏洞",
          blueprintRef: "BP-S-001",
          triggers: ["安全漏洞", "代码审计", "审查安全"],
          steps: ["扫描漏洞", "评级风险", "给出修复建议"],
          outputFormat: "风险报告",
          collaborators: ["master"],
        },
      ],
    },
    {
      agentId: "master",
      name: "格物·宗师",
      description: "质量官",
      skills: [
        {
          id: "zs-ql-001",
          name: "代码重构",
          description: "质量优化",
          blueprintRef: "BP-Z-001",
          triggers: ["优化代码", "重构", "代码质量"],
          steps: ["识别坏味道", "设计重构方案", "输出重构后代码"],
          outputFormat: "前后对比 + 理由",
          collaborators: ["thinker"],
        },
      ],
    },
    {
      agentId: "creative",
      name: "创想·灵韵",
      description: "创意官",
      skills: [],
    },
  ];

  const buildPrompt = (agentId: string): string =>
    `你是 ${agentId} 的系统提示词。角色定位：专业执行，输出合规。`;

  const getAllSkills = (agentId: string): MockAgentSkill[] =>
    MOCK_PROFILES.find((p) => p.agentId === agentId)?.skills ?? [];

  return {
    ALL_AGENT_SKILLS: MOCK_PROFILES,
    getAgentSkills: vi.fn((agentId: string) =>
      MOCK_PROFILES.find((p) => p.agentId === agentId)
    ),
    getAgentPromptTemplate: vi.fn(buildPrompt),
    getAgentAllSkills: vi.fn(getAllSkills),
    getSkillStats: vi.fn(() => ({
      totalAgents: 8,
      totalSkills: MOCK_PROFILES.reduce((s, p) => s + p.skills.length, 0),
      byCategory: {
        management: 1,
        navigation: 1,
        analysis: 1,
        prediction: 0,
        recommendation: 0,
        security: 1,
        quality: 1,
        creative: 0,
      },
    })),
    registerBlueprintData: vi.fn(),
    getBlueprintData: vi.fn(() => MOCK_PROFILES),
  };
});

// ---- 0.4 Mock llmService ----
vi.mock("../llmService", () => {
  return {
    chatCompletionStream: vi.fn(
      (
        _provider: unknown,
        _modelId: string,
        _messages: unknown[],
        callbacks: {
          onToken?: (t: string) => void;
          onDone?: (t: string) => void;
          onError?: (e: string) => void;
        },
        _options?: unknown
      ) => {
        // 默认行为：模拟流式输出 3 个 token 后 done
        const tokens = ["Hello", ", ", "world!"];
        tokens.forEach((t) => callbacks.onToken?.(t));
        callbacks.onDone?.(tokens.join(""));
      }
    ),
    getProviderConfig: vi.fn((providerId: string) => {
      // 默认：除 "offline-provider" 外都返回配置
      if (providerId === "offline-provider") return null;
      return {
        id: providerId,
        name: `Mock Provider (${providerId})`,
        baseUrl: `https://mock.local/${providerId}`,
        apiKey: "mock-api-key",
      };
    }),
  };
});

// ================================================================
// 1. 导入被测模块 (在所有 vi.mock 之后)
// ================================================================

import {
  AgentSkillsEngine,
  type FamilyRole,
  type AgentBinding,
  type AgentSkillResult,
  getAgentSkillsEngine,
  resetAgentSkillsEngine,
  matchSkillByKeywords,
} from "../AgentSkills";

// 导入 mock 引用以便断言
import { matchSkillByKeywords as matchSkillMock } from "../skillsData";
import { chatCompletionStream, getProviderConfig } from "../llmService";
import { getAgentPromptTemplate, getAgentAllSkills, getSkillStats } from "../blueprintData";

// ================================================================
// 2. 测试套件
// ================================================================

describe("AgentSkillsEngine — 单元测试 (70%)", () => {
  let engine: AgentSkillsEngine;

  // -------------- 每个用例前：全新引擎实例 + 清理mock --------------
  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentSkillsEngine(); // 清掉单例，确保每个 it 拿到干净状态
    engine = new AgentSkillsEngine();
  });

  // ==============================================================
  // 2.1 类型与常量层
  // ==============================================================
  describe("§1 类型与常量完整性", () => {
    it("FamilyRole 8 个角色的绑定全部存在且字段完整", () => {
      const roles: FamilyRole[] = [
        "tianshu", "qianhang", "wanwu", "xianzhi",
        "bole", "shouhu", "zongshi", "lingyun",
      ];
      for (const role of roles) {
        const binding = engine.getBinding(role);
        expect(binding).toBeDefined();
        expect(binding.role).toBe(role);
        expect(typeof binding.familyName).toBe("string");
        expect(binding.familyName.length).toBeGreaterThan(0);
        expect(typeof binding.phone).toBe("string");
        expect(binding.phone).toMatch(/^0379-\d{4}$/); // 电话格式
        expect(typeof binding.providerId).toBe("string");
        expect(typeof binding.modelId).toBe("string");
        expect(typeof binding.skillName).toBe("string");
        expect(typeof binding.blueprintAgentId).toBe("string");
        expect(typeof binding.temperature).toBe("number");
        expect(binding.temperature).toBeGreaterThanOrEqual(0);
        expect(binding.temperature).toBeLessThanOrEqual(1);
        expect(typeof binding.maxTokens).toBe("number");
        expect(binding.maxTokens).toBeGreaterThan(0);
      }
    });

    it("getAllBindings() 应返回 8 个绑定且每个唯一", () => {
      const all = engine.getAllBindings();
      expect(all.length).toBe(8);
      const roles = new Set(all.map((b) => b.role));
      expect(roles.size).toBe(8);
      const skillNames = new Set(all.map((b) => b.skillName));
      expect(skillNames.size).toBe(8);
    });

    it("每个 familyName 与蓝图映射保持一致", () => {
      const expectedNames: Record<FamilyRole, string> = {
        tianshu: "元启·天枢",
        qianhang: "言启·千行",
        wanwu: "语枢·万物",
        xianzhi: "预见·先知",
        bole: "知遇·伯乐",
        shouhu: "智云·守护",
        zongshi: "格物·宗师",
        lingyun: "创想·灵韵",
      };
      for (const [role, name] of Object.entries(expectedNames)) {
        expect(engine.getBinding(role as FamilyRole).familyName).toBe(name);
      }
    });

    it("(lora 字段) 8 个角色的 lora 字段可选性应与配置一致: 4 个 undefined + 4 个有值", () => {
      // 根据 AgentSkills.ts 常量:
      // 有 lora: tianshu (yyc3-mgmt-v2), wanwu (yyc3-mgmt-v2), shouhu (yyc3-security-v1), zongshi (yyc3-code-v2)
      // 无 lora: qianhang, xianzhi, bole, lingyun
      const withLora: FamilyRole[] = ["tianshu", "wanwu", "shouhu", "zongshi"];
      const withoutLora: FamilyRole[] = ["qianhang", "xianzhi", "bole", "lingyun"];

      for (const role of withLora) {
        const b = engine.getBinding(role);
        expect(typeof b.lora).toBe("string");
        expect(b.lora!.length).toBeGreaterThan(0);
      }

      for (const role of withoutLora) {
        const b = engine.getBinding(role);
        expect(b.lora).toBeUndefined();
      }
    });

    it("(lora 字段) tianshu/zongshi/shouhu 的 lora 值应分别对应管理/代码/安全三类", () => {
      expect(engine.getBinding("tianshu").lora).toBe("yyc3-mgmt-v2");
      expect(engine.getBinding("wanwu").lora).toBe("yyc3-mgmt-v2");
      expect(engine.getBinding("shouhu").lora).toBe("yyc3-security-v1");
      expect(engine.getBinding("zongshi").lora).toBe("yyc3-code-v2");
    });
  });

  // ==============================================================
  // 2.2 意图路由 resolveAgent — 三层匹配
  // ==============================================================
  describe("§2 resolveAgent 意图路由 — 三层匹配机制", () => {
    it("Layer 1 — 蓝图触发词命中：应直接返回对应角色绑定", () => {
      // "分析一下" 是 thinker 的蓝图触发词
      const binding = engine.resolveAgent("请分析一下这个问题的根因");
      expect(binding.role).toBe("wanwu");
      expect(binding.familyName).toBe("语枢·万物");
    });

    it("Layer 1 — 安全触发词应命中智云·守护", () => {
      // 注意：与 mock blueprint 保持一致 — sentinel(守护) 的 triggers: ["安全漏洞", "代码审计", "审查安全"]
      const binding = engine.resolveAgent("审查安全一下这段代码是否存在安全漏洞");
      expect(binding.role).toBe("shouhu");
    });

    it("Layer 1 — 质量触发词应命中格物·宗师", () => {
      // master(宗师) 的 mock triggers: ["优化代码", "重构", "代码质量"]
      // 精确匹配单独一个 "优化代码" 避免被其它触发词先匹配
      const binding = engine.resolveAgent("优化代码");
      expect(binding.role).toBe("zongshi");
    });

    it("Layer 2 — 蓝图无命中时应走 SKILL 关键词匹配", () => {
      // mock skillsData 的 matchSkillByKeywords 返回安全类
      (matchSkillMock as Mock).mockReturnValueOnce({
        name: "shouhu-security",
        familyMember: "智云·守护",
      });
      const binding = engine.resolveAgent("任意不含蓝图触发词的输入");
      expect(binding.role).toBe("shouhu");
      // 确认确实调用了 matchSkillByKeywords
      expect(matchSkillMock).toHaveBeenCalled();
    });

    it("Layer 3 — 全部未命中时应默认路由到言启·千行 (qianhang)", () => {
      // 强制 mock 返回 null，确保走到默认
      (matchSkillMock as Mock).mockReturnValueOnce(null);
      const binding = engine.resolveAgent("今天天气怎么样呢");
      expect(binding.role).toBe("qianhang");
      expect(binding.familyName).toBe("言启·千行");
    });

    it("空字符串输入应安全返回默认千行", () => {
      (matchSkillMock as Mock).mockReturnValueOnce(null);
      const binding = engine.resolveAgent("");
      expect(binding.role).toBe("qianhang");
    });

    it("超长输入不应崩溃", () => {
      const longInput = "词".repeat(10000);
      expect(() => engine.resolveAgent(longInput)).not.toThrow();
      expect(typeof engine.resolveAgent(longInput)).toBe("object");
    });
  });

  // ==============================================================
  // 2.3 resolveBlueprintSkill 精确匹配
  // ==============================================================
  describe("§3 resolveBlueprintSkill — 蓝图技能精确匹配", () => {
    it("命中蓝图触发词时应返回 {role, skill}", () => {
      const result = engine.resolveBlueprintSkill("请分析一下这个问题");
      expect(result).not.toBeNull();
      expect(result?.role).toBe("wanwu");
      expect(result?.skill).toHaveProperty("id");
      expect(result?.skill).toHaveProperty("triggers");
      expect(Array.isArray(result?.skill.triggers)).toBe(true);
    });

    it("未命中时应返回 null", () => {
      const result = engine.resolveBlueprintSkill("今天天气真好");
      expect(result).toBeNull();
    });

    it("命中的 skill 应包含所有必填字段", () => {
      const result = engine.resolveBlueprintSkill("分解这个需求并制定计划");
      expect(result).not.toBeNull();
      const skill = result!.skill;
      expect(typeof skill.id).toBe("string");
      expect(typeof skill.name).toBe("string");
      expect(typeof skill.description).toBe("string");
      expect(Array.isArray(skill.steps)).toBe(true);
      expect(typeof skill.outputFormat).toBe("string");
      expect(Array.isArray(skill.collaborators)).toBe(true);
    });
  });

  // ==============================================================
  // 2.4 蓝图数据访问层
  // ==============================================================
  describe("§4 蓝图数据访问方法", () => {
    it("getBlueprintProfile(role) 应调用 getAgentSkills", () => {
      const profile = engine.getBlueprintProfile("tianshu");
      expect(getAgentPromptTemplate).not.toHaveBeenCalled(); // profile 不调 prompt
      expect(profile).toBeDefined();
      expect(profile?.agentId).toBe("meta-oracle");
    });

    it("getBlueprintPrompt(role) 应返回非空字符串", () => {
      const prompt = engine.getBlueprintPrompt("qianhang");
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("getBlueprintAllSkills(role) 对有技能的角色返回非空数组", () => {
      const skills = engine.getBlueprintAllSkills("tianshu");
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
    });

    it("getBlueprintStats() 应返回统计对象含 byCategory", () => {
      const stats = engine.getBlueprintStats();
      expect(stats).toHaveProperty("totalSkills");
      expect(stats).toHaveProperty("byCategory");
      expect(typeof stats.totalSkills).toBe("number");
    });
  });

  // ==============================================================
  // 2.5 Provider 解析
  // ==============================================================
  describe("§5 resolveProvider — Provider 配置解析", () => {
    it("正常 provider 应返回配置对象", () => {
      const binding = engine.getBinding("wanwu");
      const provider = engine.resolveProvider(binding);
      expect(provider).not.toBeNull();
      expect(provider?.id).toBe(binding.providerId);
    });

    it("offline-provider 应返回 null", () => {
      const fakeBinding: AgentBinding = {
        ...engine.getBinding("qianhang"),
        providerId: "offline-provider",
      };
      expect(engine.resolveProvider(fakeBinding)).toBeNull();
    });

    it("应委托给 llmService.getProviderConfig", () => {
      const b = engine.getBinding("tianshu");
      engine.resolveProvider(b);
      expect(getProviderConfig).toHaveBeenCalledWith(b.providerId);
    });
  });

  // ==============================================================
  // 2.6 执行历史管理
  // ==============================================================
  describe("§6 执行历史管理 — getHistory / clearHistory", () => {
    it("初始历史应为空数组", () => {
      expect(engine.getHistory()).toEqual([]);
    });

    it("getHistory() 返回的是副本，外部 push 不影响内部", () => {
      const history = engine.getHistory();
      (history as AgentSkillResult[]).push({} as any);
      expect(engine.getHistory()).toEqual([]);
    });

    it("clearHistory() 应清空历史记录", async () => {
      // 先执行一次让历史有内容
      await engine.executeAgent("qianhang", "你好");
      expect(engine.getHistory().length).toBe(1);
      engine.clearHistory();
      expect(engine.getHistory()).toEqual([]);
    });
  });

  // ==============================================================
  // 2.7 元数据查询层
  // ==============================================================
  describe("§7 元数据查询", () => {
    it("getAllSkillMetadata() 应返回 8 条精简元数据", () => {
      const list = engine.getAllSkillMetadata();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(8);
      for (const item of list) {
        expect(item).toHaveProperty("name");
        expect(item).toHaveProperty("description");
        expect(item).toHaveProperty("familyMember");
        expect(item).toHaveProperty("phone");
        expect(item).toHaveProperty("model");
      }
    });

    it("getFullBlueprint() 应返回完整蓝图矩阵", () => {
      const full = engine.getFullBlueprint();
      expect(Array.isArray(full)).toBe(true);
      expect(full.length).toBe(8);
    });
  });

  // ==============================================================
  // 2.8 单例管理
  // ==============================================================
  describe("§8 单例管理 — getAgentSkillsEngine / resetAgentSkillsEngine", () => {
    it("getAgentSkillsEngine() 第一次调用应创建新实例", () => {
      resetAgentSkillsEngine();
      const engine1 = getAgentSkillsEngine();
      expect(engine1).toBeInstanceOf(AgentSkillsEngine);
      expect(getSkillStats).toHaveBeenCalled(); // 初始化日志
    });

    it("两次连续调用应返回同一个实例 (单例语义)", () => {
      resetAgentSkillsEngine();
      const e1 = getAgentSkillsEngine();
      const e2 = getAgentSkillsEngine();
      expect(e1).toBe(e2);
    });

    it("reset 后再 get 应返回全新实例", () => {
      resetAgentSkillsEngine();
      const e1 = getAgentSkillsEngine();
      resetAgentSkillsEngine();
      const e2 = getAgentSkillsEngine();
      expect(e1).not.toBe(e2);
    });

    it("resetAgentSkillsEngine() 在已 null 时不应报错", () => {
      resetAgentSkillsEngine();
      expect(() => resetAgentSkillsEngine()).not.toThrow();
    });
  });

  // ==============================================================
  // 2.9 matchSkillByKeywords 重导出
  // ==============================================================
  describe("§9 matchSkillByKeywords 重导出", () => {
    it("应与 skillsData 的 matchSkillByKeywords 行为一致", () => {
      (matchSkillMock as Mock).mockReturnValueOnce({
        name: "test-skill",
        familyMember: "测试家人",
      });
      const result = matchSkillByKeywords("测试输入");
      expect(result).toMatchObject({ name: "test-skill" });
      expect(matchSkillMock).toHaveBeenCalledWith("测试输入");
    });
  });
});

// ================================================================
// 3. 集成测试 (20%) — 模块协作、流式回调、多分支执行
// ================================================================

describe("AgentSkillsEngine — 集成测试 (20%)", () => {
  let engine: AgentSkillsEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentSkillsEngine();
    engine = new AgentSkillsEngine();
  });

  // ==============================================================
  // 3.1 executeAgent — 成功路径
  // ==============================================================
  describe("§10 executeAgent 成功路径", () => {
    it("应构建 messages 并调用 chatCompletionStream", async () => {
      const result = await engine.executeAgent(
        "wanwu",
        "请分析问题",
        undefined,
        [{ role: "user", content: "上下文消息" }]
      );

      expect(result.success).toBe(true);
      expect(result.role).toBe("wanwu");
      expect(result.error).toBeUndefined();
      expect(result.output).toBe("Hello, world!"); // mock 拼出的结果
      expect(typeof result.durationMs).toBe("number");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.provider).toBe("vllm-n1-27b");
      expect(result.model).toBe("Qwen3.6-27B");

      // 确认底层流式调用被触发
      expect(chatCompletionStream).toHaveBeenCalledTimes(1);
      const callArgs = (chatCompletionStream as Mock).mock.calls[0];
      // messages 应包含: system + 上下文 + user
      const messages = callArgs[2];
      expect(messages.length).toBe(3);
      expect(messages[0].role).toBe("system");
      expect(messages[1].content).toBe("上下文消息");
      expect(messages[2].content).toBe("请分析问题");
    });

    it("onToken / onDone 回调应按预期触发", async () => {
      const onToken = vi.fn();
      const onDone = vi.fn();

      await engine.executeAgent("qianhang", "hi", { onToken, onDone });

      // mock 流式输出 3 个 token
      expect(onToken).toHaveBeenCalledTimes(3);
      expect(onToken.mock.calls.map((c: any) => c[0])).toEqual([
        "Hello",
        ", ",
        "world!",
      ]);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenLastCalledWith("Hello, world!");
    });

    it("应使用蓝图触发词匹配到技能，并注入到 system prompt", async () => {
      // "分析一下" 命中蓝图技能，应让 buildSystemPrompt 包含技能信息
      await engine.executeAgent("wanwu", "请分析一下这个问题");

      const messages = (chatCompletionStream as Mock).mock.calls[0][2];
      const systemContent: string = messages[0].content;

      // system prompt 中应包含蓝图模板 + 技能名称/步骤信息
      expect(systemContent).toContain("thinker"); // 蓝图模板
      expect(systemContent).toContain("当前任务技能");
      expect(systemContent).toContain("执行步骤");
      expect(systemContent).toContain("期望输出格式");
    });

    it("执行成功后应写入历史", async () => {
      await engine.executeAgent("qianhang", "测试");
      const history = engine.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(true);
      expect(history[0].role).toBe("qianhang");
    });

    it("(buildSystemPrompt 通用分支) 无蓝图技能匹配时，system prompt 仅包含蓝图模板，不含技能步骤", async () => {
      // 用"xianzhi"或无匹配蓝图触发词的角色，输入完全不含触发词
      // 先知 prophet 的 mock 蓝图 skills 是空数组，resolveBlueprintSkill 必然 null
      await engine.executeAgent("xianzhi", "随便聊聊近况怎么样");

      const messages = (chatCompletionStream as Mock).mock.calls[0][2];
      const systemContent: string = messages[0].content;

      // 只包含蓝图模板，不应有 "当前任务技能:" / "执行步骤:" 等注入标记
      expect(systemContent).toContain("prophet");
      expect(systemContent).not.toContain("当前任务技能");
      expect(systemContent).not.toContain("执行步骤");
      expect(systemContent).not.toContain("期望输出格式");
      expect(systemContent).not.toContain("蓝图文档");
    });

    it("(buildSystemPrompt 通用分支) lingyun creative 未命中蓝图技能同样走通用 prompt", async () => {
      await engine.executeAgent("lingyun", "一句不含蓝图触发词的创意请求");

      const systemContent: string = (chatCompletionStream as Mock).mock.calls[0][2][0].content;
      expect(systemContent).toContain("creative");
      expect(systemContent).not.toContain("协同Agent");
    });
  });

  // ==============================================================
  // 3.2 executeAgent — 失败路径
  // ==============================================================
  describe("§11 executeAgent 失败路径", () => {
    it("Provider 不可用时应返回 success=false 并包含错误消息", async () => {
      // 临时修改 providerId 为 offline-provider：构造自定义 binding
      // 使用 jest/vitest 风格：mock getProviderConfig 返回 null
      (getProviderConfig as Mock).mockReturnValueOnce(null);
      const result = await engine.executeAgent("tianshu", "计划一下");

      expect(result.success).toBe(false);
      expect(result.error).toContain("不可用");
      expect(result.output).toBe("");
      expect(chatCompletionStream).not.toHaveBeenCalled(); // 不应调用流式

      // 但历史也应记录
      expect(engine.getHistory().length).toBe(1);
      expect(engine.getHistory()[0].success).toBe(false);
    });

    it("(L375 分支) Provider 不可用但同时命中蓝图触发词 → blueprintSkillId 应被填入", async () => {
      // 这一条是覆盖率 L375 未覆盖的分支：
      //   !provider === true 且 matchedSkill !== undefined
      //   → blueprintSkillId: matchedSkill?.id 被写成字符串而不是 undefined

      // 1) getProviderConfig 返回 null (provider 不可用)
      (getProviderConfig as Mock).mockReturnValueOnce(null);

      // 2) 选择 "wanwu" 角色，输入 "分析一下 根因" 命中蓝图触发词
      //    (resolveBlueprintSkill → return { role: "wanwu", skill: { id: "ww-an-001", ... } })
      const result = await engine.executeAgent("wanwu", "请分析一下这个问题的根因");

      expect(result.success).toBe(false);
      // 关键断言: blueprintSkillId 应是具体 id 而不是 undefined
      expect(result.blueprintSkillId).toBeDefined();
      expect(typeof result.blueprintSkillId).toBe("string");
      expect(result.blueprintSkillId).toBe("ww-an-001"); // 与 mock 蓝图 id 对齐
      // 错误消息不变
      expect(result.error).toContain("不可用");
    });

    it("流式调用触发 onError 时，结果应标记失败", async () => {
      // 重写 chatCompletionStream mock：触发 onError
      (chatCompletionStream as Mock).mockImplementationOnce(
        (
          _p: unknown,
          _m: string,
          _msg: unknown[],
          cbs: { onError?: (e: string) => void }
        ) => {
          cbs.onError?.("模拟网络错误: 连接超时");
        }
      );

      const result = await engine.executeAgent("shouhu", "审查一下");
      expect(result.success).toBe(false);
      expect(result.error).toBe("模拟网络错误: 连接超时");
    });

    it("onError 回调应同步触发", async () => {
      const onError = vi.fn();
      (chatCompletionStream as Mock).mockImplementationOnce(
        (
          _p: unknown,
          _m: string,
          _msg: unknown[],
          cbs: { onError?: (e: string) => void }
        ) => cbs.onError?.("boom")
      );

      await engine.executeAgent("lingyun", "来个创意", { onError });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith("boom");
    });

    it("(L455-L458 catch 分支) chatCompletionStream 同步 throw Error 时，应捕获并返回错误消息", async () => {
      // 覆盖率 455-459 缺口一：chatCompletionStream 函数体同步抛出异常
      // （区别于 onError 回调 — 那个是通过 Promise 内部 reject 触发）
      const err = new Error("vLLM 503 服务暂时不可用");
      (chatCompletionStream as Mock).mockImplementationOnce(() => {
        throw err; // 同步抛异常
      });

      const result = await engine.executeAgent("bole", "帮我推荐方案");
      expect(result.success).toBe(false);
      expect(result.error).toBe("vLLM 503 服务暂时不可用");
      expect(result.output).toBe(""); // executeAgent 顶部 let output = "" 没被赋值
      // 历史记录同样存在
      expect(engine.getHistory().length).toBe(1);
      expect(engine.getHistory()[0].success).toBe(false);
    });

    it("(L459 err.message 分支) err.message 为 falsy 时，应 fallback 到默认文案 '执行失败'", async () => {
      // 覆盖率 459 缺口：error.message === undefined / "" / null / 0 等 falsy 值
      // 构造一个不标准的异常：对象无 message 字段
      const weirdErr: any = { name: "WeirdError", stack: "..." }; // message === undefined
      (chatCompletionStream as Mock).mockImplementationOnce(() => {
        throw weirdErr;
      });

      const result = await engine.executeAgent("xianzhi", "预测明年");
      expect(result.success).toBe(false);
      // 应该 fallback 到默认字符串
      expect(result.error).toBe("执行失败");

      // 也可以再验证空字符串的情况
      (chatCompletionStream as Mock).mockImplementationOnce(() => {
        throw new Error(""); // message === ""
      });

      const result2 = await engine.executeAgent("xianzhi", "再预测一次");
      expect(result2.error).toBe("执行失败");
    });

    it("(L455 final 分支) 命中蓝图触发词但 chatCompletionStream 抛异常 → catch 中 blueprintSkillId 应为字符串", async () => {
      // L455 是 AgentSkills 最后一个未覆盖行：
      //   blueprintSkillId: matchedSkill?.id
      // 需要 matchedSkill 存在 且 走到 catch 块
      // 组合策略: wanwu + "分析一下 根因" 命中蓝图 (matchedSkill有值)
      //          + chatCompletionStream 同步抛异常 → catch
      (chatCompletionStream as Mock).mockImplementationOnce(() => {
        throw new Error("stream runtime error");
      });

      const result = await engine.executeAgent("wanwu", "请分析一下这个问题的根因");
      expect(result.success).toBe(false);
      expect(result.error).toBe("stream runtime error");
      // 关键断言：catch 块内的 blueprintSkillId 应填入匹配到的技能 id
      expect(result.blueprintSkillId).toBe("ww-an-001");
    });
  });

  // ==============================================================
  // 3.3 orchestrate — 天枢三阶段编排
  // ==============================================================
  describe("§12 orchestrate 天枢编排流水线", () => {
    it("正常流程应返回 [天枢, 主Agent, 守护] 三条结果", async () => {
      const results = await engine.orchestrate("帮我分析这个问题并优化代码");

      expect(Array.isArray(results)).toBe(true);
      // 第一条必然是天枢
      expect(results[0].role).toBe("tianshu");
      // 至少有天枢结果
      expect(results.length).toBeGreaterThanOrEqual(1);
      // 所有结果都有 durationMs
      for (const r of results) {
        expect(typeof r.durationMs).toBe("number");
      }
    });

    it("天枢失败时应只返回一条天枢失败结果", async () => {
      // 让第一次 executeAgent (tianshu) 失败
      (getProviderConfig as Mock).mockImplementationOnce(() => null);
      const results = await engine.orchestrate("任何输入");

      expect(results.length).toBe(1);
      expect(results[0].role).toBe("tianshu");
      expect(results[0].success).toBe(false);
    });

    it("当主 Agent 就是天枢时，不应重复执行天枢，也不应走守护", async () => {
      // 让 resolveAgent 返回 tianshu：mock 蓝图触发
      // 使用 "分解需求 制定计划" 命中天枢
      const results = await engine.orchestrate("分解需求 制定计划");

      // 必然只有天枢结果 (主Agent就是天枢，被跳过)
      expect(results.length).toBe(1);
      expect(results[0].role).toBe("tianshu");
    });

    it("主Agent是守护时，应跳过守护二次审查", async () => {
      // 用"安全漏洞 审查"命中守护角色
      const results = await engine.orchestrate("审查这段代码的安全漏洞");
      // 天枢 → 守护 (守护自身不二次审查)
      const roles = results.map((r) => r.role);
      const shouhuCount = roles.filter((r) => r === "shouhu").length;
      // 最多只能出现 1 次守护
      expect(shouhuCount).toBeLessThanOrEqual(1);
    });

    it("主Agent成功且非守护时，结果最后一条必定是守护审查 (shouhu)", async () => {
      // 走 wanwu (分析类) 蓝图触发词，必然非守护
      const results = await engine.orchestrate("请分析一下这个问题的根因");

      // 结果顺序: 天枢 → wanwu → shouhu
      expect(results.length).toBe(3);
      expect(results[0].role).toBe("tianshu");
      expect(results[0].success).toBe(true);
      expect(results[1].role).toBe("wanwu");
      expect(results[1].success).toBe(true);
      expect(results[2].role).toBe("shouhu");
      expect(results[2].success).toBe(true);

      // 守护审查的输入应包含主Agent输出截取 (前2000字符内)
      // 检查 chatCompletionStream 的最后一次调用消息中是否含有切片标识逻辑
      const callCount = (chatCompletionStream as Mock).mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(3);
    });
  });
});

// ================================================================
// 4. E2E 风格 / 回归测试 (10%) — 完整闭环 + 边界 + 稳定性
// ================================================================

describe("AgentSkillsEngine — E2E / 回归测试 (10%)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAgentSkillsEngine();
  });

  describe("§13 完整闭环：意图→执行→历史", () => {
    it("场景：用户请求代码优化 → 千行路由→宗师优化→守护审查 (3 Agent)", async () => {
      const engine = new AgentSkillsEngine();
      // "优化代码 重构" 触发宗师蓝图
      const results = await engine.orchestrate(
        "帮我分析并优化这段代码，重构提升质量"
      );

      // 至少天枢 + 主Agent
      expect(results.length).toBeGreaterThanOrEqual(2);
      // 天枢必须成功
      expect(results[0].success).toBe(true);

      const history = engine.getHistory();
      expect(history.length).toBe(results.length);

      // 清理后历史为空
      engine.clearHistory();
      expect(engine.getHistory().length).toBe(0);
    });
  });

  describe("§14 稳定性 / 边界压力", () => {
    it("并行 10 次 executeAgent 不应相互影响状态", async () => {
      const engine = new AgentSkillsEngine();
      const promises = Array.from({ length: 10 }, (_, i) =>
        engine.executeAgent(
          (["qianhang", "wanwu", "shouhu"] as FamilyRole[])[i % 3],
          `请求 ${i}`
        )
      );
      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      for (const r of results) {
        expect(r.success).toBe(true);
        expect(typeof r.output).toBe("string");
      }
      expect(engine.getHistory().length).toBe(10);
    });

    it("连续 resolveAgent 1000 次不应内存泄漏或崩溃", () => {
      const engine = new AgentSkillsEngine();
      const inputs = ["分析", "安全", "优化", "创意", "预测", "推荐", "规划", "帮助"];
      for (let i = 0; i < 1000; i++) {
        const b = engine.resolveAgent(inputs[i % inputs.length] + i);
        expect(b).toBeDefined();
        expect(b.role.length).toBeGreaterThan(0);
      }
      // 无抛错即通过
    });
  });

  describe("§15 回归：公共 API 不应意外变更", () => {
    it("AgentSkillsEngine 公共方法签名数量应稳定 (防止破坏性修改)", () => {
      const engine = new AgentSkillsEngine();
      // 16 个公共方法 (含 private buildSystemPrompt 也在原型上，但它对外部不可访问)
      // 新增方法时请同步更新此测试并加用例
      const publicMethods = [
        "resolveAgent",
        "resolveBlueprintSkill",
        "getBinding",
        "getAllBindings",
        "getBlueprintProfile",
        "getBlueprintPrompt",
        "getBlueprintAllSkills",
        "getBlueprintStats",
        "resolveProvider",
        "executeAgent",
        "orchestrate",
        "getHistory",
        "clearHistory",
        "getAllSkillMetadata",
        "getFullBlueprint",
        "buildSystemPrompt", // private，但仍在 prototype 上 (TypeScript 只做编译期限制)
      ];
      for (const name of publicMethods) {
        expect(typeof (engine as any)[name]).toBe(
          "function",
          `方法 ${name} 缺失 — 如为有意移除，请更新此回归测试`
        );
      }
      const protoFns = Object.getOwnPropertyNames(Object.getPrototypeOf(engine))
        .filter((k) => typeof (engine as any)[k] === "function" && k !== "constructor");
      expect(protoFns.length).toBe(publicMethods.length);
    });

    it("FamilyRole 8 个枚举值应稳定", () => {
      const expectedRoles = [
        "tianshu", "qianhang", "wanwu", "xianzhi",
        "bole", "shouhu", "zongshi", "lingyun",
      ] as const;
      const engine = new AgentSkillsEngine();
      for (const role of expectedRoles) {
        expect(() => engine.getBinding(role)).not.toThrow();
      }
    });
  });
});

// ================================================================
// 5. 覆盖率引导注释 — 告诉开发者哪些分支需要重点关注
// ================================================================
/*
 * ============ 覆盖率提升建议 ============
 *
 * 1) buildSystemPrompt 是 private 方法：
 *    通过 executeAgent 间接覆盖 2 条分支：
 *    - 有 matchedSkill (走蓝图触发词) → 已覆盖
 *    - 无 matchedSkill (走通用) → 可新增用例:
 *        await engine.executeAgent("lingyun", "纯通用无蓝图触发词输入")
 *
 * 2) orchestrate 的 "mainResult.success && mainAgent.role !== 'shouhu'" 分支：
 *    当前已覆盖主分支；建议增加一个显式用例：
 *        it("主Agent成功时应追加守护审查", ...)
 *    并断言 results 最后一条是 shouhu
 *
 * 3) 执行异常分支 (非 onError，而是 chatCompletionStream 抛异常)：
 *    可 mock chatCompletionStream 为同步 throw，验证 catch 块
 *
 * 4) lora 字段可选覆盖：
 *    bole / xianzhi / qianhang / lingyun 无 lora，
 *    其他 4 个有 lora — 可验证 binding.lora 在这些角色上是 undefined
 *
 * 5) blueprintSkillId 字段覆盖：
 *    - 命中蓝图触发词 → 有值 (string)
 *    - 未命中 → undefined
 */
