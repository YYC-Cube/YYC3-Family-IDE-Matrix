/**
 * @file: AgentMarket.test.tsx
 * @description: Agent 市场面板冒烟测试 — 渲染/Tab 切换/搜索过滤/安装切换
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[agent],[market],[smoke]
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AgentMarket from "../AgentMarket";
import { PanelHeader } from "../../panel-host";

describe("PanelHeader（面板宿主）", () => {
  it("渲染标题与图标，透出 data-panel-id", () => {
    const { container } = render(
      <PanelHeader
        panelId="market"
        title="Agent 市场"
        icon={<span data-testid="icon" />}
      />
    );
    expect(screen.getByText("Agent 市场")).toBeDefined();
    expect(container.querySelector("[data-panel-id='market']")).not.toBeNull();
    expect(screen.getByTestId("icon")).toBeDefined();
  });

  it("右侧动作区渲染 children", () => {
    render(
      <PanelHeader title="T" panelId="x">
        <button>刷新</button>
      </PanelHeader>
    );
    expect(screen.getByRole("button", { name: "刷新" })).toBeDefined();
  });
});

describe("AgentMarket", () => {
  it("默认渲染 Agent 模板列表与面板标题", () => {
    render(<AgentMarket nodeId="n1" />);
    expect(screen.getByText("Agent 市场")).toBeDefined();
    // 7 个内置模板全部渲染
    expect(screen.getByText("智能编程助手")).toBeDefined();
    expect(screen.getByText("运维自动化 Agent")).toBeDefined();
    // 已安装标记出现 3 处（a1/a4/a7）
    expect(screen.getAllByText("已安装")).toHaveLength(3);
  });

  it("Tab 切换到插件市场并展示插件列表", () => {
    render(<AgentMarket nodeId="n1" />);
    fireEvent.click(screen.getByText("插件市场"));
    expect(screen.getByText("代码格式化引擎")).toBeDefined();
    expect(screen.getByText("Git 增强工具")).toBeDefined();
  });

  it("搜索框按名称/标签过滤模板", () => {
    render(<AgentMarket nodeId="n1" />);
    const input = screen.getByPlaceholderText("搜索...");
    fireEvent.change(input, { target: { value: "RAG" } });
    expect(screen.getByText("知识库问答 Agent")).toBeDefined();
    expect(screen.queryByText("智能编程助手")).toBeNull();
  });

  it("点击安装按钮切换安装状态", () => {
    render(<AgentMarket nodeId="n1" />);
    // 4 个未安装模板各有「安装」按钮，取第一个点击
    fireEvent.click(screen.getAllByRole("button", { name: "安装" })[0]);
    // 安装后按钮变为卸载，已安装标记 3 → 4
    expect(screen.getAllByText("已安装")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "卸载" })).toHaveLength(4);
  });
});
