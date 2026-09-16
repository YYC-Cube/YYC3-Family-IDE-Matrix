/**
 * @file: services/pipeline/__tests__/AIPipeline.test.ts
 * @description: AIPipeline 端到端闭环测试 — mock LLM 层验证 回复→解析→落盘→diff 全链路
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @tags: [test],[ai],[pipeline],[e2e]
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileStoreZustand } from "../../../stores/useFileStoreZustand";
import {
  collectPipelineContext,
  previewPlanFromReply,
  runPipeline,
} from "../AIPipeline";

// mock LLM 依赖层（proxyAdapter + LLMService），FileStore 用真实内存态实现
vi.mock("../../llm/proxyAdapter", () => ({
  smartChatCompletion: vi.fn(),
}));
vi.mock("../../llm/LLMService", () => ({
  findAvailableProvider: vi.fn(),
}));
vi.mock("../../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { findAvailableProvider } from "../../llm/LLMService";
import { smartChatCompletion } from "../../llm/proxyAdapter";
import type { ProviderConfig } from "../../llm/types";

const mockSmartChat = vi.mocked(smartChatCompletion);
const mockFindProvider = vi.mocked(findAvailableProvider);

const providerStub: { config: ProviderConfig; modelId: string } = {
  config: {
    id: "zai-plan",
    name: "测试供应商",
    nameEn: "Test Provider",
    baseUrl: "http://localhost",
    authType: "bearer",
    apiKey: "sk-test",
    models: [
      { id: "test-model", name: "Test Model", type: "llm", maxTokens: 4096 },
    ],
    isLocal: false,
    detected: true,
    description: "测试用",
    docsUrl: "",
  },
  modelId: "test-model",
};

const LLM_REPLY = [
  "好的，我来创建组件：",
  "```tsx",
  "// filepath: src/components/Greeting.tsx",
  "export default function Greeting() {",
  '  return <h1>Hello YYC³</h1>;',
  "}",
  "```",
].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
  mockFindProvider.mockReturnValue(providerStub);
  mockSmartChat.mockResolvedValue(LLM_REPLY);
  useFileStoreZustand.getState().initializeProject({
    "src/App.tsx": "existing",
  });
});

// ── collectPipelineContext ──

describe("collectPipelineContext", () => {
  it("默认从 FileStore 收集上下文", () => {
    const ctx = collectPipelineContext();
    expect(ctx.totalFiles).toBe(1);
    expect(ctx.allFilePaths).toEqual(["src/App.tsx"]);
  });

  it("支持部分覆盖输入", () => {
    const ctx = collectPipelineContext({
      fileContents: { "src/only.ts": "x" },
      gitBranch: "feature/ai",
    });
    expect(ctx.totalFiles).toBe(1);
    expect(ctx.gitSummary.branch).toBe("feature/ai");
  });
});

// ── previewPlanFromReply ──

describe("previewPlanFromReply", () => {
  it("解析回复并生成 diff，不落盘", () => {
    const preview = previewPlanFromReply(
      LLM_REPLY,
      { "src/components/Greeting.tsx": "old" },
      "创建一个 Greeting 组件",
    );

    expect(preview.intent).toBe("generate");
    expect(preview.plan.fileCount).toBe(1);
    expect(preview.diffs["src/components/Greeting.tsx"]).toContainEqual(
      expect.objectContaining({ type: "added" }),
    );
    // 不落盘
    expect(useFileStoreZustand.getState().fileContents).not.toHaveProperty(
      "src/components/Greeting.tsx",
    );
  });

  it("无 userMessage 时意图回退 general", () => {
    const preview = previewPlanFromReply("no code here", {});
    expect(preview.intent).toBe("general");
    expect(preview.plan.blocks).toHaveLength(0);
  });
});

// ── runPipeline（端到端）──

describe("runPipeline", () => {
  it("完整闭环：用户消息 → LLM → 解析 → 落盘 → diff", async () => {
    const result = await runPipeline({ userMessage: "创建一个 Greeting 组件" });

    // LLM 收到的消息结构：system + user
    expect(mockSmartChat).toHaveBeenCalledTimes(1);
    const [, , messages] = mockSmartChat.mock.calls[0];
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("任务：代码生成");
    expect(messages[messages.length - 1].content).toBe("创建一个 Greeting 组件");

    // 落盘验证
    expect(result.plan).not.toBeNull();
    expect(result.applied).not.toBeNull();
    expect(result.applied!.success).toBe(true);
    expect(result.applied!.appliedFiles).toEqual(["src/components/Greeting.tsx"]);

    const files = useFileStoreZustand.getState().fileContents;
    expect(files["src/components/Greeting.tsx"]).toContain("Hello YYC³");

    // diff 验证（新文件全行 added，共 3 行代码）
    expect(result.diffs["src/components/Greeting.tsx"]).toEqual([
      { type: "added", content: "export default function Greeting() {", lineNumber: 1 },
      { type: "added", content: "  return <h1>Hello YYC³</h1>;", lineNumber: 2 },
      { type: "added", content: "}", lineNumber: 3 },
    ]);
  });

  it("修改已有文件走 updateFile 语义并产生 removed+added diff", async () => {
    mockSmartChat.mockResolvedValue(
      [
        "```ts",
        "// filepath: src/App.tsx",
        "export default function AppV2() {}",
        "```",
      ].join("\n"),
    );

    const result = await runPipeline({ userMessage: "更新 App 组件" });
    const files = useFileStoreZustand.getState().fileContents;
    expect(files["src/App.tsx"]).toContain("AppV2");
    expect(result.diffs["src/App.tsx"]).toContainEqual(
      expect.objectContaining({ type: "removed", content: "existing" }),
    );
  });

  it("纯对话场景：无代码块 → plan/applied 为 null", async () => {
    mockSmartChat.mockResolvedValue("这是一个纯文本解释，没有代码块。");

    const result = await runPipeline({ userMessage: "解释一下这段代码的作用" });
    expect(result.intent).toBe("explain");
    expect(result.plan).toBeNull();
    expect(result.applied).toBeNull();
    expect(result.diffs).toEqual({});
    // FileStore 未被改动
    expect(Object.keys(useFileStoreZustand.getState().fileContents)).toEqual([
      "src/App.tsx",
    ]);
  });

  it("对话历史注入 LLM 消息（截取最近 10 条）", async () => {
    const history = Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `msg-${i}`,
    }));

    await runPipeline({ userMessage: "继续", conversationHistory: history });

    const [, , messages] = mockSmartChat.mock.calls[0];
    // system + 10 条历史 + 1 条 user = 12
    expect(messages).toHaveLength(12);
    expect(messages[1].content).toBe("msg-4");
  });

  it("无可用 Provider 时抛出明确错误", async () => {
    mockFindProvider.mockReturnValue(null);
    await expect(runPipeline({ userMessage: "创建组件" })).rejects.toThrow(
      "无可用 LLM Provider",
    );
    expect(mockSmartChat).not.toHaveBeenCalled();
  });

  it("LLM 失败时错误向上传播", async () => {
    mockSmartChat.mockRejectedValue(new Error("network down"));
    await expect(runPipeline({ userMessage: "创建组件" })).rejects.toThrow(
      "network down",
    );
  });
});
