/**
 * @file: index.ts
 * @description: MCP 服务层统一出口 — Client / Tools / Prompts / Resources
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [mcp],[service],[index],[barrel],[re-export]
 *
 * brief: MCP 能力域的「单一入口」，消费方从这里按需 import
 *
 * usage:
 * ```
 * import {
 *   createMCPClient,
 *   MCPToolManager,
 *   MCPPromptManager,
 *   MCPResourceManager,
 * } from "@/services/mcp";
 *
 * const client = createMCPClient({ serverUrl: "https://mcp.example.com" });
 * await client.connect();
 * const tools = new MCPToolManager(client);
 * ```
 *
 * dependencies: ../logger
 * exports: MCPClient 全量类型与实现
 */

export {
  MCPClient,
  createMCPClient,
} from "./MCPClient";

export type {
  MCPConfig,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolCallResult,
  MCPResourceContent,
  CacheHint,
} from "./MCPClient";

export {
  FileSystemTools,
  GitTools,
  DatabaseTools,
  MemoryTools,
  MCPToolManager,
} from "./MCPTools";

export {
  MCPPromptManager,
} from "./MCPPrompts";

export type {
  PromptTemplate,
  PromptMessage,
} from "./MCPPrompts";

export {
  MCPResourceManager,
} from "./MCPResources";

export type {
  CachedResource,
  ResourceSubscription,
} from "./MCPResources";
