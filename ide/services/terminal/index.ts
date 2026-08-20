/**
 * @file: index.ts
 * @description: 终端沙箱统一出口 — 服务/策略/供应商/类型
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[index],[barrel]
 *
 * brief: terminal-api 的安全前置层（批③决策二）；供应商按 DI 注册，
 *        默认提供 DryRun；接入 E2B/Cloudflare 时注入其 SDK 即可
 */

export { TerminalService, SandboxError } from "./TerminalService";
export { createTerminalService, resolveSandboxConfigFromEnv } from "./createTerminalService";
export type { SandboxServiceConfig, SandboxProviderKind, TerminalServiceFactoryResult } from "./createTerminalService";
export type { TerminalServiceOptions } from "./TerminalService";

export { SandboxPolicy } from "./policy";

export { DryRunProvider } from "./providers/DryRunProvider";
export { E2BProvider } from "./providers/E2BProvider";
export type { E2BSDKLike, E2BSandboxLike, E2BProviderOptions } from "./providers/E2BProvider";
export { CloudflareProvider } from "./providers/CloudflareProvider";
export type { CloudflareSDKLike, CloudflareSandboxLike } from "./providers/CloudflareProvider";

export type {
  CommandRequest,
  ExecResult,
  SandboxProvider,
  PolicyDecision,
  PolicyVerdict,
  SandboxPolicyConfig,
  AuditEntry,
  AuditOutcome,
} from "./types";
