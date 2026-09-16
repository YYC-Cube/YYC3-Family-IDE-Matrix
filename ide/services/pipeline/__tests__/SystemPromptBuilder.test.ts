/**
 * @file: services/pipeline/__tests__/SystemPromptBuilder.test.ts
 * @description: SystemPromptBuilder 单元测试 — 意图检测（中英双语）/Prompt 组装/互锁输出格式
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @tags: [test],[ai],[pipeline],[prompt]
 */

import { describe, expect, it } from "vitest";
import type { ProjectContext } from "../ContextCollector";
import {
  buildChatMessages,
  buildSystemPrompt,
  detectIntent,
  estimateTokens,
  type UserIntent,
} from "../SystemPromptBuilder";

// ── detectIntent ──

describe("detectIntent", () => {
  const cases: [string, UserIntent][] = [
    // 中文
    ["帮我创建一个登录组件", "generate"],
    ["写一个 TodoList 页面", "generate"],
    ["修改这个按钮的颜色", "modify"],
    ["把标题改成蓝色", "modify"],
    ["修复登录页报错", "fix"],
    ["这段代码为什么会崩溃", "fix"],
    ["解释一下这段代码", "explain"],
    ["分析代码的原理", "explain"],
    ["重构这个模块", "refactor"],
    ["优化性能瓶颈", "refactor"],
    ["帮我生成单元测试", "test"],
    ["写一下 spec 文件", "test"],
    ["帮我审查这段代码", "review"],
    // 英文
    ["create a new component", "generate"],
    ["fix the login bug", "fix"],
    ["explain this code", "explain"],
    ["refactor this function", "refactor"],
    ["write unit tests", "test"],
    ["code review please", "review"],
    ["update the styling", "modify"],
  ];

  it.each(cases)("%s → %s", (message, expected) => {
    expect(detectIntent(message)).toBe(expected);
  });

  it("无匹配 → general", () => {
    expect(detectIntent("你好")).toBe("general");
    expect(detectIntent("今天天气如何")).toBe("general");
  });

  it("意图优先级：test 优先于 generate（'写测试' 不误判为生成）", () => {
    expect(detectIntent("写一个测试")).toBe("test");
  });
});

// ── buildSystemPrompt ──

const mockContext: ProjectContext = {
  fileTree: "📁 src/\n   📄 index.ts",
  activeFile: { path: "src/index.ts", content: "export const a = 1;" },
  openTabs: ["src/index.ts"],
  modifiedFiles: [],
  totalFiles: 1,
  allFilePaths: ["src/index.ts"],
  selectedFilesContent: {},
  gitSummary: { branch: "main", changedFiles: 0, stagedFiles: 0 },
};

describe("buildSystemPrompt", () => {
  it("代码类意图包含输出格式约束（与 CodeApplicator 互锁）", () => {
    for (const intent of ["generate", "modify", "fix", "refactor", "test"] as const) {
      const prompt = buildSystemPrompt(intent, null);
      expect(prompt).toContain("代码输出格式要求");
      expect(prompt).toContain("// filepath:");
    }
  });

  it("explain/review/general 不包含输出格式约束", () => {
    for (const intent of ["explain", "review", "general"] as const) {
      expect(buildSystemPrompt(intent, null)).not.toContain("代码输出格式要求");
    }
  });

  it("注入项目上下文", () => {
    const prompt = buildSystemPrompt("generate", mockContext);
    expect(prompt).toContain("项目上下文");
    expect(prompt).toContain("src/index.ts");
    expect(prompt).toContain("export const a = 1;");
  });

  it("agentPersona 人设注入（P2 AgentFleet 预留接口）", () => {
    const prompt = buildSystemPrompt("general", null, {
      agentPersona: "你是元启天枢",
    });
    expect(prompt).toContain("智能体角色");
    expect(prompt).toContain("元启天枢");
  });

  it("customInstructions 附加段", () => {
    const prompt = buildSystemPrompt("general", null, {
      customInstructions: "始终使用中文回复",
    });
    expect(prompt).toContain("额外指令");
    expect(prompt).toContain("始终使用中文回复");
  });

  it("包含技术栈参考", () => {
    expect(buildSystemPrompt("general", null)).toContain("技术栈参考");
  });
});

// ── buildChatMessages ──

describe("buildChatMessages", () => {
  const history = [
    { role: "user" as const, content: "消息1" },
    { role: "assistant" as const, content: "回复1" },
  ];

  it("组装为 [system, ...history, user] 结构", () => {
    const messages = buildChatMessages("修复报错", history, null);
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe("system");
    expect(messages[messages.length - 1]).toEqual({ role: "user", content: "修复报错" });
    expect(messages[1]).toEqual({ role: "user", content: "消息1" });
  });

  it("maxHistoryMessages 截断历史（保留最近 N 条）", () => {
    const messages = buildChatMessages("新问题", history, null, {
      maxHistoryMessages: 1,
    });
    // system + 最近 1 条历史 + user
    expect(messages).toHaveLength(3);
    expect(messages[1]).toEqual({ role: "assistant", content: "回复1" });
  });

  it("system 消息随用户消息意图变化", () => {
    const fixMessages = buildChatMessages("修复这个bug", [], null);
    expect(fixMessages[0].content).toContain("任务：错误修复");

    const explainMessages = buildChatMessages("解释这段代码", [], null);
    expect(explainMessages[0].content).toContain("任务：代码解释");
  });
});

// ── estimateTokens ──

describe("estimateTokens", () => {
  it("按 ~3.5 chars/token 粗估", () => {
    expect(estimateTokens("a".repeat(35))).toBe(10);
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("短")).toBe(1);
  });
});
