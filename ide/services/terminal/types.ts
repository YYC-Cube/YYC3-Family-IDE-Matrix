/**
 * @file: types.ts
 * @description: 终端沙箱共享类型 — 命令/结果/供应商/策略/审计
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[types]
 */

/** 一次命令执行请求 */
export interface CommandRequest {
  command: string;
  args?: string[];
  workdir?: string;
  /** 本次执行超时（毫秒），服务层会以 maxTimeoutMs 截断 */
  timeoutMs?: number;
}

/** 命令执行结果（shell 语义） */
export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** 是否因超时被终止 */
  timedOut?: boolean;
}

/**
 * 沙箱供应商抽象 —— 双供应商策略（批③决策二）：
 * 托管 API（E2B / Cloudflare Sandbox）与自托管（Daytona，后续）实现同一接口，
 * TerminalService 侧保持可替换。
 */
export interface SandboxProvider {
  readonly name: string;
  execute(request: CommandRequest, signal?: AbortSignal): Promise<ExecResult>;
  dispose?(): void;
}

// ── 策略 ──

export type PolicyVerdict = "allowed" | "denied";

export interface PolicyDecision {
  verdict: PolicyVerdict;
  /** 拒绝原因（审计用） */
  reason?: string;
}

export interface SandboxPolicyConfig {
  /** 命令白名单（精确命令名）；"*" 表示全放行（交给 blockedPatterns 收敛） */
  allowedCommands: string[] | "*";
  /** 危险模式黑名单（正则，匹配即拒绝，优先于白名单） */
  blockedPatterns?: RegExp[];
  /** 默认超时（毫秒） */
  defaultTimeoutMs?: number;
  /** 超时上限（毫秒），请求值会被截断到此值 */
  maxTimeoutMs?: number;
  /** 会话级配额 */
  session: {
    maxCommands: number;
    windowMs: number;
  };
}

// ── 审计 ──

export type AuditOutcome =
  | "denied"
  | "quota-blocked"
  | "timeout"
  | "executed"
  | "exec-failed";

export interface AuditEntry {
  timestamp: number;
  sessionKey: string;
  command: string;
  outcome: AuditOutcome;
  reason?: string;
  provider?: string;
  durationMs?: number;
}
