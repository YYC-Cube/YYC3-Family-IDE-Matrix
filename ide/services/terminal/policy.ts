/**
 * @file: policy.ts
 * @description: 沙箱策略层 — 命令白名单/黑名单模式/会话配额/审计日志
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[policy],[audit]
 *
 * brief: 批③决策二的本地策略层 —— 托管沙箱 API 之前的第一道闸门
 *
 * details:
 * - 黑名单模式优先于白名单（危险命令无论是否在白名单都拒绝）
 * - 会话配额：滑动窗口内 maxCommands 条（默认 60s / 30 条）
 * - 审计日志环形上限 500 条，供运维面板消费
 */

import type {
  AuditEntry,
  AuditOutcome,
  PolicyDecision,
  SandboxPolicyConfig,
} from "./types";

const AUDIT_LIMIT = 500;

/** shell 元字符（审计 H1）：出现在完整命令行即拒绝 */
const SHELL_METACHAR_RE = /[;|&$`<>()\r\n]/;

export class SandboxPolicy {
  private config: Required<
    Pick<SandboxPolicyConfig, "defaultTimeoutMs" | "maxTimeoutMs">
  > &
    SandboxPolicyConfig;
  private usage = new Map<string, number[]>();
  private auditLog: AuditEntry[] = [];

  constructor(config: SandboxPolicyConfig) {
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 10_000,
      maxTimeoutMs: config.maxTimeoutMs ?? 60_000,
      ...config,
    };
  }

  /**
   * 命令准入检查：黑名单模式优先（匹配完整命令行，含参数），其次白名单
   * @param name 命令名（白名单匹配）
   * @param fullCommand 完整命令行（黑名单正则匹配；缺省用 name）
   */
  check(name: string, fullCommand?: string): PolicyDecision {
    const line = fullCommand ?? name;

    // 审计 H1 修复：参数中出现 shell 元字符一律拒绝（`;|&$\\`<>()` 换行/回车）。
    // 白名单只校验命令名，元字符可借参数注入任意命令（如 echo "x"; rm -rf /），
    // 因此这是比黑名单更前置的硬闸门；引号包裹的元字符同样拒绝（从严）。
    if (SHELL_METACHAR_RE.test(line)) {
      return {
        verdict: "denied",
        reason: "shell metacharacters in command line are not allowed",
      };
    }

    for (const pattern of this.config.blockedPatterns ?? []) {
      if (pattern.test(line)) {
        return {
          verdict: "denied",
          reason: `matched blocked pattern: ${pattern.source}`,
        };
      }
    }

    if (this.config.allowedCommands !== "*") {
      if (!this.config.allowedCommands.includes(name)) {
        return {
          verdict: "denied",
          reason: `command not in allowlist: ${name}`,
        };
      }
    }

    return { verdict: "allowed" };
  }

  /** 解析本次执行超时（截断到上限） */
  resolveTimeout(requestedMs?: number): number {
    const raw = requestedMs ?? this.config.defaultTimeoutMs;
    return Math.min(Math.max(raw, 100), this.config.maxTimeoutMs);
  }

  /** 会话配额检查（不记账；记账由 recordUsage 完成） */
  isWithinQuota(sessionKey: string, now = Date.now()): boolean {
    const { maxCommands, windowMs } = this.config.session;
    const stamps = (this.usage.get(sessionKey) ?? []).filter(
      (t) => now - t < windowMs,
    );
    this.usage.set(sessionKey, stamps);
    return stamps.length < maxCommands;
  }

  /** 记一次配额内使用 */
  recordUsage(sessionKey: string, now = Date.now()): void {
    const stamps = this.usage.get(sessionKey) ?? [];
    stamps.push(now);
    this.usage.set(sessionKey, stamps);
  }

  /** 写审计（环形） */
  audit(entry: Omit<AuditEntry, "timestamp">): void {
    this.auditLog.push({ ...entry, timestamp: Date.now() });
    if (this.auditLog.length > AUDIT_LIMIT) {
      this.auditLog.splice(0, this.auditLog.length - AUDIT_LIMIT);
    }
  }

  /** 读取审计日志（新→旧） */
  getAuditLog(limit = 100): AuditEntry[] {
    return this.auditLog.slice(-limit).reverse();
  }

  /** 会话用量统计（运维面板用） */
  getSessionStats(sessionKey: string, now = Date.now()): {
    commandsInWindow: number;
    windowMs: number;
    maxCommands: number;
  } {
    const stamps = (this.usage.get(sessionKey) ?? []).filter(
      (t) => now - t < this.config.session.windowMs,
    );
    return {
      commandsInWindow: stamps.length,
      windowMs: this.config.session.windowMs,
      maxCommands: this.config.session.maxCommands,
    };
  }

  /** 清空某会话或全部配额记录 */
  resetQuota(sessionKey?: string): void {
    if (sessionKey) this.usage.delete(sessionKey);
    else this.usage.clear();
  }
}
