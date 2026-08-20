/**
 * @file: TerminalService.ts
 * @description: 终端服务 — 策略闸门（白名单/配额/超时）+ 双供应商沙箱执行 + 审计
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[service],[policy]
 *
 * brief: 批③决策二实施 —— terminal-api 的安全前置层，任何命令必经此闸门
 *
 * details（执行管线）:
 *   命令 → 黑名单/白名单检查 → 会话配额 → 超时解析(截断上限)
 *       → SandboxProvider.execute(AbortSignal) → 审计 → 结果
 * - 拒绝语义遵循 shell 惯例：denied=exit 126，quota=exit 129，timeout=exit 124
 * - 全量审计：每次请求无论成败均落 AuditEntry（环形 500 条）
 */

import { logger } from "../logger";
import { SandboxPolicy } from "./policy";
import type {
  AuditOutcome,
  CommandRequest,
  ExecResult,
  SandboxProvider,
} from "./types";

/** 沙箱拒绝错误（策略/配额/供应商缺失） */
export class SandboxError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
    this.name = "SandboxError";
  }
}

export interface TerminalServiceOptions {
  policy: SandboxPolicy;
  /** 默认供应商名（须已注册） */
  defaultProvider: string;
}

export class TerminalService {
  private providers = new Map<string, SandboxProvider>();

  constructor(private readonly options: TerminalServiceOptions) {}

  registerProvider(provider: SandboxProvider, makeDefault = false): void {
    this.providers.set(provider.name, provider);
    if (makeDefault) this.options.defaultProvider = provider.name;
  }

  getProviderNames(): string[] {
    return [...this.providers.keys()];
  }

  async execute(
    sessionKey: string,
    request: CommandRequest,
    providerName?: string,
  ): Promise<ExecResult> {
    const command = [request.command, ...(request.args ?? [])].join(" ");
    const policy = this.options.policy;

    // 1) 准入：黑名单（完整命令行）→ 白名单（命令名）
    const decision = policy.check(request.command, command);
    if (decision.verdict === "denied") {
      policy.audit({
        sessionKey,
        command,
        outcome: "denied",
        reason: decision.reason,
      });
      throw new SandboxError(
        `[sandbox] 命令被拒绝：${decision.reason}`,
        126,
      );
    }

    // 2) 会话配额
    if (!policy.isWithinQuota(sessionKey)) {
      policy.audit({ sessionKey, command, outcome: "quota-blocked" });
      throw new SandboxError(
        `[sandbox] 会话配额已用尽（窗口内命令数达到上限）`,
        129,
      );
    }

    // 3) 供应商解析
    const provider =
      this.providers.get(providerName ?? this.options.defaultProvider) ??
      null;
    if (!provider) {
      throw new SandboxError(
        `[sandbox] 未注册的供应商：${providerName ?? this.options.defaultProvider}`,
        127,
      );
    }

    // 4) 超时闸门（截断上限）+ 执行
    policy.recordUsage(sessionKey);
    const timeoutMs = policy.resolveTimeout(request.timeoutMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    let result: ExecResult;
    let outcome: AuditOutcome;

    try {
      result = await provider.execute(request, controller.signal);
      outcome = result.exitCode === 0 ? "executed" : "exec-failed";
    } catch (error) {
      result = {
        exitCode: 1,
        stdout: "",
        stderr: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      };
      outcome = "exec-failed";
    } finally {
      clearTimeout(timer);
    }

    if (controller.signal.aborted) {
      result = {
        ...result,
        exitCode: 124,
        timedOut: true,
        stderr: result.stderr || `[sandbox] 执行超时（${timeoutMs}ms）已终止`,
      };
      outcome = "timeout";
      logger.warn(`[Terminal] timeout: ${command} (${timeoutMs}ms)`);
    }

    policy.audit({
      sessionKey,
      command,
      outcome,
      provider: provider.name,
      durationMs: result.durationMs,
    });

    return result;
  }

  dispose(): void {
    for (const provider of this.providers.values()) {
      provider.dispose?.();
    }
    this.providers.clear();
  }
}
