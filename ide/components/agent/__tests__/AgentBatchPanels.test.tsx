/**
 * @file: AgentBatchPanels.test.tsx
 * @description: Agent 编排批次面板冒烟测试 — 编排器（Provider 包裹）/ 多 Agent 流水线面板 / i18n
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[agent],[orchestrator],[panel],[smoke]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AgentOrchestrator from "../AgentOrchestrator";
import MultiAgentPanel from "../MultiAgentPanel";
import { ModelRegistryProvider } from "../ModelRegistry";
import { useMemoryStore } from "../../../stores/useMemoryStore";
import { useI18n, translate } from "../../../i18n";

// 编排器与流水线面板不真正发起 LLM 调用（冒烟仅渲染与本地交互）
vi.mock("../../../services/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/llm")>();
  return {
    ...actual,
    chatCompletion: vi.fn().mockResolvedValue(""),
    chatCompletionStream: vi.fn().mockResolvedValue(undefined),
    testModelConnectivity: vi.fn().mockResolvedValue({
      success: true, latencyMs: 10, modelId: "m", providerId: "ollama", timestamp: 0,
    }),
    detectOllama: vi.fn().mockResolvedValue({ available: false, models: [] }),
  };
});

beforeEach(async () => {
  useMemoryStore.setState({ memories: [], initialized: false, loading: false });
  await useMemoryStore.getState().initialize();
});

describe("AgentOrchestrator", () => {
  it("在 ModelRegistryProvider 内渲染画布与节点面板", () => {
    render(
      <ModelRegistryProvider>
        <AgentOrchestrator nodeId="n-orch" />
      </ModelRegistryProvider>
    );
    expect(screen.getByText("Agent 编排")).toBeDefined();
  });

  it("缺少 Provider 时按预期抛出（上下文契约）", () => {
    // useModelRegistry 的显式契约：必须包裹 ModelRegistryProvider
    expect(() => render(<AgentOrchestrator nodeId="n1" />)).toThrow(
      /must be used within ModelRegistryProvider/
    );
  });
});

describe("MultiAgentPanel", () => {
  it("渲染四角色流水线主界面", () => {
    render(<MultiAgentPanel nodeId="n-multi" />);
    expect(screen.getByText("Multi-Agent")).toBeDefined();
    // 流水线面板提供可交互按钮（工具栏动作）
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("面板挂载面板宿主令牌作用域并正常卸载", () => {
    const { container, unmount } = render(<MultiAgentPanel nodeId="n-multi" />);
    expect(container.querySelector(".panel-host-root")).not.toBeNull();
    expect(() => unmount()).not.toThrow();
  });
});

describe("i18n", () => {
  it("useI18n 返回默认 zh-CN 语言态", () => {
    let locale = "";
    const Probe = () => {
      const i18n = useI18n();
      locale = i18n.locale;
      return null;
    };
    render(<Probe />);
    expect(locale).toBe("zh-CN");
  });

  it("translate 中文键原样返回（zh 负载缺失时的兜底行为）", () => {
    // 回迁版字典以中文值为准；translate 对未知 key 返回 key 本身
    const result = translate("__definitely_missing_key__", undefined, "zh-CN");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
