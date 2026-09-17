/**
 * @file: components/agent/__tests__/FleetChatView.test.tsx
 * @description: FleetChatView 冒烟测试 — 渲染/健康徽标/路由预测/发送闭环（mock agentFleet）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @tags: [test],[agent],[fleet],[ui]
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentHealth } from "../../../services/agent/AgentFleet";

const healthAllMock = vi.fn();
const routeAndChatMock = vi.fn();

vi.mock("../../../services/agent/AgentFleet", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../services/agent/AgentFleet")>();
  return {
    ...original,
    agentFleet: {
      healthAll: (...args: unknown[]) => healthAllMock(...args),
      routeAndChat: (...args: unknown[]) => routeAndChatMock(...args),
      routeTask: original.agentFleet.routeTask.bind(original.agentFleet),
    },
  };
});

import FleetChatView from "../FleetChatView";

const healthStub = (status: AgentHealth["status"]): AgentHealth => ({
  status,
  agent: "x",
  label: "x",
  role: "x",
  uptime_seconds: 1,
  vllm_reachable: true,
  model: "m",
  frozen: false,
  frozen_reason: "",
  governance_connected: "",
  timestamp: new Date().toISOString(),
});

beforeEach(() => {
  vi.clearAllMocks();
  healthAllMock.mockResolvedValue({
    "yuanqi-tianshu": healthStub("healthy"),
    "yanqi-qianhang": healthStub("healthy"),
    "yushu-wanwu": { error: "down" },
    "yujian-xianzhi": healthStub("degraded"),
    "zhiyu-bole": healthStub("healthy"),
    "zhiyun-shouhu": healthStub("healthy"),
    "gewu-zongshi": healthStub("healthy"),
    "chuangxiang-lingyun": healthStub("healthy"),
  });
});

describe("FleetChatView", () => {
  it("渲染舰队状态条（6/8 在线）", async () => {
    render(<FleetChatView />);
    await waitFor(() => {
      expect(screen.getByText(/6\/8 在线/)).toBeInTheDocument();
    });
  });

  it("健康探测失败时显示 0/8 不崩溃", async () => {
    healthAllMock.mockRejectedValue(new Error("all down"));
    render(<FleetChatView />);
    await waitFor(() => {
      expect(screen.getByText(/0\/8 在线/)).toBeInTheDocument();
    });
  });

  it("发送任务走 routeAndChat 并渲染回复 + 舰队标识", async () => {
    routeAndChatMock.mockResolvedValue({
      agent: { id: "yanqi-qianhang", label: "言启千行", port: 25601, role: "代码生成" },
      via: "fleet",
      result: { response: "代码已生成", latency_ms: 1200 },
    });

    render(<FleetChatView />);
    const input = screen.getByPlaceholderText(/描述任务/);
    fireEvent.change(input, { target: { value: "帮我生成一个登录组件" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("代码已生成")).toBeInTheDocument();
    });
    expect(screen.getByText("舰队")).toBeInTheDocument();
    expect(screen.getByText(/1\.2s/)).toBeInTheDocument();
    expect(routeAndChatMock).toHaveBeenCalledWith("帮我生成一个登录组件");
  });

  it("失败时渲染错误信息", async () => {
    routeAndChatMock.mockRejectedValue(new Error("舰队不可达"));
    render(<FleetChatView />);
    const input = screen.getByPlaceholderText(/描述任务/);
    fireEvent.change(input, { target: { value: "任意任务" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText(/舰队不可达/)).toBeInTheDocument();
    });
  });
});
