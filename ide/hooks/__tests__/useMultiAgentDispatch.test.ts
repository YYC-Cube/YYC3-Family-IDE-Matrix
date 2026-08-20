/**
 * @file: useMultiAgentDispatch.test.ts
 * @description: Multi-Agent 调度链路单测 — 流水线阶段 / 流式回调 / 回退 / 取消 / 记忆写入
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[multi-agent],[dispatch],[pipeline]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMultiAgentDispatch } from "../useMultiAgentDispatch";
import { useMemoryStore } from "../../stores/useMemoryStore";
import { chatCompletion, chatCompletionStream } from "../../services/llm";

vi.mock("../../services/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/llm")>();
  return {
    ...actual,
    chatCompletion: vi.fn(),
    chatCompletionStream: vi.fn(),
  };
});

const mockStream = vi.mocked(chatCompletionStream);
const mockChat = vi.mocked(chatCompletion);

/** 模拟流式成功：逐 token 回调后 onDone */
function streamOk(tokens: string[], fullText: string) {
  return vi.fn().mockImplementation(
    async (_p: unknown, _m: string, _msgs: unknown, callbacks: {
      onToken: (t: string) => void;
      onDone: (f: string) => void;
      onError: (e: string) => void;
    }) => {
      for (const t of tokens) callbacks.onToken(t);
      callbacks.onDone(fullText);
    }
  );
}

beforeEach(async () => {
  mockStream.mockReset();
  mockChat.mockReset();
  useMemoryStore.setState({ memories: [], initialized: false, loading: false });
  await useMemoryStore.getState().initialize();
});

describe("useMultiAgentDispatch", () => {
  it("hasProvider：ollama 无需 Key 恒可用", () => {
    const { result } = renderHook(() => useMultiAgentDispatch());
    expect(result.current.hasProvider).toBe(true);
  });

  it("executePipeline 完成 Planner→Coder→Tester→Reviewer 四阶段并写入记忆", async () => {
    const outputs = ["规划A", "代码B", "测试C", "评审D"];
    mockStream
      .mockImplementationOnce(streamOk(["规", "划"], outputs[0]))
      .mockImplementationOnce(streamOk(outputs[1].split(""), outputs[1]))
      .mockImplementationOnce(streamOk([outputs[2]], outputs[2]))
      .mockImplementationOnce(streamOk([outputs[3]], outputs[3]));

    const { result } = renderHook(() => useMultiAgentDispatch());

    await act(async () => {
      await result.current.executePipeline("做一个计数器组件");
    });

    expect(result.current.state.stage).toBe("completed");
    expect(result.current.state.error).toBeNull();
    // 四个阶段结果按序累积
    expect(result.current.state.results.map((r) => r.role)).toEqual([
      "planner",
      "coder",
      "tester",
      "reviewer",
    ]);
    expect(result.current.state.results.every((r) => r.success)).toBe(true);
    // 流式调用 4 次，温度按角色差异化（planner 0.3 / coder 0.7）
    expect(mockStream).toHaveBeenCalledTimes(4);
    expect(mockStream.mock.calls[0][4]).toMatchObject({ temperature: 0.3, maxTokens: 2048 });
    expect(mockStream.mock.calls[1][4]).toMatchObject({ temperature: 0.7, maxTokens: 4096 });
    // planner 与 reviewer 结果写入记忆（排除种子数据 mem-seed-*）
    const added = useMemoryStore
      .getState()
      .memories.filter((m) => m.id.startsWith("mem-") && !m.id.startsWith("mem-seed"));
    expect(added).toHaveLength(2);
    expect(added[0].agent).toBe("planner");
    expect(added[1].agent).toBe("reviewer");
  });

  it("流式失败时回退到非流式调用", async () => {
    mockStream.mockImplementation(async () => {
      throw new Error("stream broken");
    });
    mockChat.mockResolvedValue("回退输出");

    const { result } = renderHook(() => useMultiAgentDispatch());

    await act(async () => {
      await result.current.executePipeline("任务");
    });

    // 四个阶段全部经 chatCompletion 回退完成
    expect(mockChat).toHaveBeenCalledTimes(4);
    expect(result.current.state.stage).toBe("completed");
    expect(result.current.state.results.every((r) => r.success && r.output === "回退输出")).toBe(
      true
    );
  });

  it("Planner 彻底失败时进入 error 阶段并中止流水线", async () => {
    mockStream.mockImplementation(async () => {
      throw new Error("boom");
    });
    mockChat.mockRejectedValue(new Error("fallback dead"));

    const { result } = renderHook(() => useMultiAgentDispatch());

    await act(async () => {
      await result.current.executePipeline("任务");
    });

    expect(result.current.state.stage).toBe("error");
    expect(result.current.state.error).toContain("规划阶段失败");
    expect(result.current.state.results).toHaveLength(1);
  });

  it("executeSingleAgent 单角色调用", async () => {
    mockStream.mockImplementationOnce(streamOk(["评"], "评审意见"));

    const { result } = renderHook(() => useMultiAgentDispatch());

    let agentResult: { role: string; success: boolean } | null = null;
    await act(async () => {
      agentResult = await result.current.executeSingleAgent("reviewer", "审查这段代码");
    });

    expect(agentResult).toMatchObject({ role: "reviewer", success: true });
  });

  it("reset 恢复初始状态", async () => {
    mockStream.mockImplementation(streamOk(["x"], "x"));
    const { result } = renderHook(() => useMultiAgentDispatch());

    await act(async () => {
      await result.current.executeSingleAgent("coder", "写代码");
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.state.stage).toBe("idle");
    expect(result.current.state.results).toHaveLength(0);
  });
});
