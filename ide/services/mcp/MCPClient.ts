/**
 * @file: MCPClient.ts
 * @description: MCP (Model Context Protocol) 客户端 - 支持 MCP 服务器连接、工具调用、资源管理
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.2.0
 * @created: 2026-03-19
 * @updated: 2026-08-20
 * @status: active
 * @license: MIT
 * @copyright: Copyright (c) 2026 YanYuCloudCube Team
 * @tags: mcp,client,protocol,ai
 *
 * brief: 回迁自 archive/ide-monolith-2026-03/services/MCPClient.ts（第一批能力域回迁）
 *
 * details:
 * - 依赖路径适配：./Logger → ../logger（统一日志服务）
 * - v1.2.0 升级 MCP 2026-07-28 规范（来源: blog.modelcontextprotocol.io/posts/2026-07-28）：
 *   1. 无状态：废除 initialize/initialized 握手与 Mcp-Session-Id，客户端身份与
 *      能力改置于 server/discover 的 params._meta（该 RPC 为可选）
 *   2. HTTP 头路由：每个请求携带 MCP-Protocol-Version / Mcp-Method，
 *      工具/提示词调用额外携带 Mcp-Name，供网关免解析 body 路由限流
 *   3. 可缓存：tools/list 等响应携带 ttlMs + cacheScope，客户端捕获暴露
 * - protocolVersion 可经 MCPConfig 覆盖（旧服务器协商回退用，弃用窗口 12 个月）
 */

import { logger } from "../logger";
export interface MCPConfig {
  serverUrl: string;
  apiKey?: string;
  timeout?: number;
  /** MCP 协议版本，默认 2026-07-28（无状态规范） */
  protocolVersion?: string;
}

/** 列表响应的缓存提示（2026-07-28 规范新增） */
export interface CacheHint {
  ttlMs?: number;
  cacheScope?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface MCPToolCallResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/** 默认协议版本：2026-07-28（无状态、可缓存、HTTP 头路由） */
const DEFAULT_PROTOCOL_VERSION = "2026-07-28";

/**
 * MCP 客户端
 */
export class MCPClient {
  private config: MCPConfig;
  private connected: boolean = false;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];
  private prompts: MCPPrompt[] = [];
  private cacheHints: Record<string, CacheHint> = {};

  constructor(config: MCPConfig) {
    this.config = config;
  }

  /**
   * 连接到 MCP 服务器（2026-07-28：无握手）
   *
   * 能力发现 server/discover 为可选 RPC：失败不阻断连接；
   * 客户端身份与能力置于其 params._meta。目录列表照常拉取并捕获缓存提示。
   */
  async connect(): Promise<boolean> {
    try {
      // 可选能力发现 — 旧服务器可能不支持，容忍失败
      try {
        const discovery = await this.request("server/discover", {
          _meta: {
            protocolVersion: this.getProtocolVersion(),
            clientInfo: {
              name: "YYC3 Family AI",
              version: "1.0.0",
            },
            capabilities: {
              roots: { listChanged: true },
              sampling: {},
            },
          },
        });
        if (discovery?.serverInfo) {
          logger.warn("[MCP] Server:", discovery.serverInfo);
        }
      } catch (error) {
        logger.warn("[MCP] server/discover unavailable (optional):", error);
      }

      this.connected = true;

      // 获取可用工具（响应可携带 ttlMs/cacheScope 缓存提示）
      const toolsResponse = await this.request("tools/list", {});
      this.tools = toolsResponse.tools || [];
      this.captureCacheHint("tools", toolsResponse);

      // 获取可用资源
      const resourcesResponse = await this.request("resources/list", {});
      this.resources = resourcesResponse.resources || [];
      this.captureCacheHint("resources", resourcesResponse);

      // 获取可用提示词
      const promptsResponse = await this.request("prompts/list", {});
      this.prompts = promptsResponse.prompts || [];
      this.captureCacheHint("prompts", promptsResponse);

      logger.warn("[MCP] Connected to server:", this.config.serverUrl);
      return true;
    } catch (error) {
      logger.error("[MCP] Connection failed:", error);
      this.connected = false;
      return false;
    }
  }

  /**
   * 断开连接（2026-07-28：握手已废除，无服务端会话需清理）
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.tools = [];
    this.resources = [];
    this.prompts = [];
    this.cacheHints = {};
    logger.warn("Disconnected");
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, any>): Promise<MCPToolCallResult> {
    if (!this.connected) {
      throw new Error("MCP client not connected");
    }

    try {
      const result = await this.request("tools/call", {
        name,
        arguments: args,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<MCPResourceContent> {
    if (!this.connected) {
      throw new Error("MCP client not connected");
    }

    try {
      const result = await this.request("resources/read", { uri });
      return result.contents[0] || {};
    } catch (error) {
      throw new Error(`Failed to read resource: ${(error as Error).message}`);
    }
  }

  /**
   * 获取提示词
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<{
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  }> {
    if (!this.connected) {
      throw new Error("MCP client not connected");
    }

    try {
      const result = await this.request("prompts/get", {
        name,
        arguments: args,
      });
      return result;
    } catch (error) {
      throw new Error(`Failed to get prompt: ${(error as Error).message}`);
    }
  }

  /**
   * 列出工具
   */
  listTools(): MCPTool[] {
    return [...this.tools];
  }

  /**
   * 列出资源
   */
  listResources(): MCPResource[] {
    return [...this.resources];
  }

  /**
   * 列出提示词
   */
  listPrompts(): MCPPrompt[] {
    return [...this.prompts];
  }

  /**
   * 发送 MCP 请求（2026-07-28：HTTP 头路由 + JSON-RPC body 双轨）
   *
   * 头部供网关/WAF 免解析路由与限流；body 保持完整 JSON-RPC 信封保证 RPC 语义。
   */
  private async request(method: string, params: any): Promise<any> {
    const response = await fetch(`${this.config.serverUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // —— 2026-07-28 头路由 ——
        "MCP-Protocol-Version": this.getProtocolVersion(),
        "Mcp-Method": method,
        ...(typeof params?.name === "string" && { "Mcp-Name": params.name }),
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.result;
  }

  /** 当前协议版本（可配置覆盖） */
  private getProtocolVersion(): string {
    return this.config.protocolVersion ?? DEFAULT_PROTOCOL_VERSION;
  }

  /** 捕获列表响应的缓存提示（存在时） */
  private captureCacheHint(kind: "tools" | "resources" | "prompts", response: any): void {
    if (response?.ttlMs != null || response?.cacheScope != null) {
      this.cacheHints[kind] = {
        ...(response.ttlMs != null && { ttlMs: response.ttlMs }),
        ...(response.cacheScope != null && { cacheScope: response.cacheScope }),
      };
    }
  }

  /**
   * 获取目录列表的缓存提示（2026-07-28 规范新增）
   */
  getCacheHints(): Record<string, CacheHint> {
    return { ...this.cacheHints };
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取工具 by 名称
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.find((t) => t.name === name);
  }

  /**
   * 获取资源 by URI
   */
  getResource(uri: string): MCPResource | undefined {
    return this.resources.find((r) => r.uri === uri);
  }

  /**
   * 获取提示词 by 名称
   */
  getPromptByName(name: string): MCPPrompt | undefined {
    return this.prompts.find((p) => p.name === name);
  }
}

// 导出单例工厂
export function createMCPClient(config: MCPConfig): MCPClient {
  return new MCPClient(config);
}

export default MCPClient;
