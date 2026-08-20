/**
 * @file: MCPClient.test.ts
 * @description: MCP 客户端单测 — 连接/工具调用/资源读取/提示词获取/错误路径
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[mcp],[client]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MCPClient, createMCPClient } from "../MCPClient";

/** 构造 JSON-RPC 成功响应 */
function rpcResponse(result: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("MCPClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connect() 成功时拉取 tools/resources/prompts 三个列表", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      switch (body.method) {
        case "initialize":
          return rpcResponse({ serverInfo: { name: "test-server" } });
        case "tools/list":
          return rpcResponse({ tools: [{ name: "read_file", description: "读文件" }] });
        case "resources/list":
          return rpcResponse({ resources: [{ uri: "file:///a.ts", name: "a.ts", description: "" }] });
        case "prompts/list":
          return rpcResponse({ prompts: [{ name: "code-review", description: "" }] });
        default:
          return rpcResponse({});
      }
    });

    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    const ok = await client.connect();

    expect(ok).toBe(true);
    expect(client.isConnected()).toBe(true);
    expect(client.listTools()).toHaveLength(1);
    expect(client.listResources()).toHaveLength(1);
    expect(client.listPrompts()).toHaveLength(1);
    // initialize 请求体包含协议版本与客户端信息
    const initBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(initBody.method).toBe("initialize");
    expect(initBody.params.protocolVersion).toBe("2024-11-05");
  });

  it("connect() 失败时返回 false 且不进入连接态", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    const ok = await client.connect();

    expect(ok).toBe(false);
    expect(client.isConnected()).toBe(false);
  });

  it("connect() 携带 apiKey 时请求头包含 Bearer 授权", async () => {
    fetchMock.mockResolvedValue(rpcResponse({ serverInfo: {} }));

    const client = new MCPClient({
      serverUrl: "https://mcp.example.com",
      apiKey: "secret-token",
    });
    await client.connect();

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-token");
  });

  it("未连接时 callTool/readResource/getPrompt 抛出错误", async () => {
    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    await expect(client.callTool("read_file", {})).rejects.toThrow("not connected");
    await expect(client.readResource("file:///a.ts")).rejects.toThrow("not connected");
    await expect(client.getPrompt("code-review")).rejects.toThrow("not connected");
  });

  it("callTool() 成功返回 success=true 与数据", async () => {
    fetchMock.mockResolvedValue(rpcResponse({ content: "file body" }));

    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    client["connected"] = true;

    const result = await client.callTool("read_file", { path: "/a.ts" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ content: "file body" });
  });

  it("callTool() JSON-RPC 错误时返回 success=false 与错误信息", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "tool not found" } }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    client["connected"] = true;

    const result = await client.callTool("nope", {});
    expect(result.success).toBe(false);
    expect(result.error).toBe("tool not found");
  });

  it("callTool() HTTP 非 2xx 时返回失败而非抛出", async () => {
    fetchMock.mockResolvedValue(
      new Response("Server Error", { status: 500, statusText: "Internal Server Error" })
    );

    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    client["connected"] = true;

    const result = await client.callTool("read_file", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Internal Server Error");
  });

  it("readResource() 返回首个 content 并可按 uri/name 检索", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.method === "resources/read") {
        return rpcResponse({
          contents: [{ uri: "file:///a.ts", text: "export const A = 1" }],
        });
      }
      return rpcResponse({});
    });

    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    client["connected"] = true;
    client["resources"] = [{ uri: "file:///a.ts", name: "a.ts", description: "" }];

    const content = await client.readResource("file:///a.ts");
    expect(content.text).toBe("export const A = 1");
    expect(client.getResource("file:///a.ts")?.name).toBe("a.ts");
  });

  it("getPrompt() 透传 name 与 arguments", async () => {
    fetchMock.mockResolvedValue(
      rpcResponse({ messages: [{ role: "user", content: { type: "text", text: "hi" } }] })
    );

    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    client["connected"] = true;

    const result = await client.getPrompt("code-review", { code: "const a" });
    expect(result.messages[0].role).toBe("user");

    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent.method).toBe("prompts/get");
    expect(sent.params.name).toBe("code-review");
  });

  it("disconnect() 清空状态并调用 shutdown", async () => {
    fetchMock.mockResolvedValue(rpcResponse({}));

    const client = new MCPClient({ serverUrl: "https://mcp.example.com" });
    client["connected"] = true;

    await client.disconnect();
    expect(client.isConnected()).toBe(false);
    expect(client.listTools()).toHaveLength(0);

    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent.method).toBe("shutdown");
  });

  it("createMCPClient() 工厂返回可用实例", () => {
    const client = createMCPClient({ serverUrl: "https://mcp.example.com" });
    expect(client).toBeInstanceOf(MCPClient);
    expect(client.isConnected()).toBe(false);
  });
});
