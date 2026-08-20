/**
 * @file: MCPManagers.test.ts
 * @description: MCP 工具/提示词/资源三个管理器单测
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[mcp],[tools],[prompts],[resources]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MCPClient, MCPResourceContent } from "../MCPClient";
import { MCPToolManager } from "../MCPTools";
import { MCPPromptManager } from "../MCPPrompts";
import { MCPResourceManager } from "../MCPResources";

/** 构造带 callTool mock 的 MCPClient 替身 */
function makeClientMock(overrides: Partial<MCPClient> = {}): MCPClient {
  return {
    callTool: vi.fn(),
    listTools: vi.fn().mockReturnValue([]),
    listResources: vi.fn().mockReturnValue([]),
    listPrompts: vi.fn().mockReturnValue([]),
    getResource: vi.fn(),
    getPromptByName: vi.fn(),
    readResource: vi.fn(),
    getPrompt: vi.fn(),
    ...overrides,
  } as unknown as MCPClient;
}

describe("MCPToolManager", () => {
  it("readFile() 成功时返回文件内容", async () => {
    const client = makeClientMock({
      callTool: vi.fn().mockResolvedValue({ success: true, data: { content: "hello" } }),
    });
    const tools = new MCPToolManager(client);
    await expect(tools.fs.readFile("/a.ts")).resolves.toBe("hello");
    expect(client.callTool).toHaveBeenCalledWith("read_file", { path: "/a.ts" });
  });

  it("writeFile() 失败时抛出错误信息", async () => {
    const client = makeClientMock({
      callTool: vi.fn().mockResolvedValue({ success: false, error: "EACCES" }),
    });
    const tools = new MCPToolManager(client);
    await expect(tools.fs.writeFile("/a.ts", "x")).rejects.toThrow("EACCES");
  });

  it("git.log() 返回 commits 列表", async () => {
    const commits = [{ hash: "abc", message: "init", author: "yyc3", date: "2026-08-20" }];
    const client = makeClientMock({
      callTool: vi.fn().mockResolvedValue({ success: true, data: { commits } }),
    });
    const tools = new MCPToolManager(client);
    await expect(tools.git.log(1)).resolves.toEqual(commits);
  });

  it("listAvailableTools() 投影 name/description", () => {
    const client = makeClientMock({
      listTools: vi.fn().mockReturnValue([
        { name: "read_file", description: "读文件", inputSchema: { type: "object", properties: {} } },
      ]),
    });
    const tools = new MCPToolManager(client);
    expect(tools.listAvailableTools()).toEqual([
      { name: "read_file", description: "读文件" },
    ]);
  });
});

describe("MCPPromptManager", () => {
  it("构造时加载 8 个内置模板", () => {
    const manager = new MCPPromptManager(makeClientMock());
    expect(manager.listTemplates()).toHaveLength(8);
    expect(manager.getTemplate("code-review")?.description).toContain("审查");
  });

  it("addTemplate/removeTemplate 维护自定义模板", () => {
    const manager = new MCPPromptManager(makeClientMock());
    manager.addTemplate({ name: "custom", description: "自定义", arguments: {} });
    expect(manager.getTemplate("custom")).toBeDefined();
    manager.removeTemplate("custom");
    expect(manager.getTemplate("custom")).toBeUndefined();
  });

  it("searchTemplates() 按名称与描述模糊匹配", () => {
    const manager = new MCPPromptManager(makeClientMock());
    expect(manager.searchTemplates("review")).toHaveLength(1);
    expect(manager.searchTemplates("不存在")).toHaveLength(0);
  });

  it("importTemplate() 非法 JSON 返回 false", () => {
    const manager = new MCPPromptManager(makeClientMock());
    expect(manager.importTemplate("{not-json")).toBe(false);
    expect(manager.importTemplate(JSON.stringify({ name: "x" }))).toBe(false);
  });

  it("importAllTemplates()/exportAllTemplates() 往返一致", () => {
    const manager = new MCPPromptManager(makeClientMock());
    const json = manager.exportAllTemplates();
    const source = new MCPPromptManager(makeClientMock());
    expect(source.importAllTemplates(json)).toBe(8);
  });

  it("useTemplate() 缺少必填参数时抛出错误", async () => {
    const client = makeClientMock({
      getPromptByName: vi.fn().mockReturnValue({
        name: "code-review",
        description: "",
        arguments: [{ name: "code", description: "", required: true }],
      }),
    });
    const manager = new MCPPromptManager(client);
    await expect(manager.useTemplate("code-review", {})).rejects.toThrow(
      "Missing required argument: code"
    );
  });

  it("getPrompt() 返回收敛后的 PromptMessage 列表", async () => {
    const client = makeClientMock({
      getPrompt: vi.fn().mockResolvedValue({
        messages: [{ role: "user", content: { type: "text", text: "审查这段" } }],
      }),
    });
    const manager = new MCPPromptManager(client);
    const messages = await manager.getPrompt("code-review", { code: "..." });
    expect(messages[0].role).toBe("user");
    expect(messages[0].content.type).toBe("text");
  });

  it("clearPromptHistory() 清除 localStorage 中的历史键", () => {
    localStorage.setItem("mcp_prompt_history", "[]");
    const manager = new MCPPromptManager(makeClientMock());
    manager.clearPromptHistory();
    expect(localStorage.getItem("mcp_prompt_history")).toBeNull();
  });
});

describe("MCPResourceManager", () => {
  const content: MCPResourceContent = { uri: "file:///a.ts", text: "v1" };

  it("readResource() 二次读取命中缓存，不再请求客户端", async () => {
    const readResource = vi.fn().mockResolvedValue(content);
    const manager = new MCPResourceManager(makeClientMock({ readResource }));

    await manager.readResource("file:///a.ts");
    await manager.readResource("file:///a.ts");

    expect(readResource).toHaveBeenCalledTimes(1);
    expect(manager.getCacheStats().totalItems).toBe(1);
  });

  it("forceRefresh=true 绕过缓存强制刷新", async () => {
    const readResource = vi.fn().mockResolvedValue(content);
    const manager = new MCPResourceManager(makeClientMock({ readResource }));

    await manager.readResource("file:///a.ts");
    await manager.readResource("file:///a.ts", true);

    expect(readResource).toHaveBeenCalledTimes(2);
  });

  it("订阅者在资源刷新时收到通知，取消订阅后不再收到", async () => {
    const readResource = vi.fn().mockResolvedValue(content);
    const manager = new MCPResourceManager(makeClientMock({ readResource }));
    const cb = vi.fn();
    const unsubscribe = manager.subscribe("file:///a.ts", cb);

    await manager.readResource("file:///a.ts");
    expect(cb).toHaveBeenCalledWith(content);

    unsubscribe();
    await manager.readResource("file:///a.ts", true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("clearCache() 指定 uri 时仅清除该条", async () => {
    const readResource = vi
      .fn()
      .mockResolvedValueOnce(content)
      .mockResolvedValueOnce({ uri: "file:///b.ts", text: "b" });
    const manager = new MCPResourceManager(makeClientMock({ readResource }));

    await manager.readResource("file:///a.ts");
    await manager.readResource("file:///b.ts");
    manager.clearCache("file:///a.ts");

    expect(manager.getCacheStats().size).toBe(1);
  });

  it("readResources() 批量读取并容忍单个失败", async () => {
    const readResource = vi
      .fn()
      .mockResolvedValueOnce(content)
      .mockRejectedValueOnce(new Error("boom"));
    const manager = new MCPResourceManager(makeClientMock({ readResource }));

    const results = await manager.readResources(["file:///a.ts", "file:///bad"]);
    expect(results.size).toBe(1);
    expect(results.get("file:///a.ts")?.text).toBe("v1");
  });

  it("exportResourceAsBlob() 优先使用 base64 blob 字段", async () => {
    const binary = btoa("binary-content");
    const readResource = vi.fn().mockResolvedValue({
      uri: "file:///bin",
      blob: binary,
      mimeType: "application/octet-stream",
    });
    const manager = new MCPResourceManager(makeClientMock({ readResource }));

    const blob = await manager.exportResourceAsBlob("file:///bin");
    expect(blob.type).toBe("application/octet-stream");
    // jsdom 的 Blob 无 .text()，以 size 验证 base64 解码后的字节数（"binary-content" = 14 字节）
    expect(blob.size).toBe(14);
  });

  it("exportResourceAsBlob() 无内容时抛出错误", async () => {
    const readResource = vi.fn().mockResolvedValue({ uri: "file:///empty" });
    const manager = new MCPResourceManager(makeClientMock({ readResource }));
    await expect(manager.exportResourceAsBlob("file:///empty")).rejects.toThrow(
      "Resource has no content"
    );
  });

  it("getResourceMetadata() 汇总资源元信息与大小", async () => {
    const readResource = vi.fn().mockResolvedValue(content);
    const manager = new MCPResourceManager(
      makeClientMock({
        readResource,
        getResource: vi.fn().mockReturnValue({
          uri: "file:///a.ts",
          name: "a.ts",
          description: "源文件",
        }),
      })
    );

    const meta = await manager.getResourceMetadata("file:///a.ts");
    expect(meta.name).toBe("a.ts");
    expect(meta.size).toBe(2); // "v1"
  });
});
