/**
 * @file: E2BProvider.ts
 * @description: E2B 托管沙箱适配器（批③决策二 MVP 路线）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[e2b],[adapter]
 *
 * brief: SDK 依赖注入的最小适配层 —— 不硬引 e2b 包，测试与替换零成本
 *
 * usage:
 * ```ts
 * import { Sandbox } from "e2b";
 * const provider = new E2BProvider({ Sandbox });
 * ```
 */

import type { CommandRequest, ExecResult, SandboxProvider } from "../types";

/** E2B SDK 的最小结构类型（版本升级时仅需校对本接口） */
export interface E2BSDKLike {
  Sandbox: {
    create(options?: { timeoutMs?: number }): Promise<E2BSandboxLike>;
  };
}

export interface E2BSandboxLike {
  commands: {
    run(
      command: string,
      options?: { timeoutMs?: number; cwd?: string },
    ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  };
  kill(): Promise<void>;
}

export interface E2BProviderOptions {
  sdk: E2BSDKLike;
  /** 沙箱创建超时（毫秒） */
  createTimeoutMs?: number;
}

export class E2BProvider implements SandboxProvider {
  readonly name = "e2b";
  private readonly options: Required<E2BProviderOptions>;

  constructor(options: E2BProviderOptions) {
    this.options = {
      createTimeoutMs: options.createTimeoutMs ?? 15_000,
      ...options,
    };
  }

  async execute(
    request: CommandRequest,
    _signal?: AbortSignal,
  ): Promise<ExecResult> {
    const start = Date.now();
    const full = [request.command, ...(request.args ?? [])].join(" ");
    const sandbox = await this.options.sdk.Sandbox.create({
      timeoutMs: this.options.createTimeoutMs,
    });

    try {
      const result = await sandbox.commands.run(full, {
        cwd: request.workdir,
      });
      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - start,
      };
    } finally {
      // 硬化：容忍 kill 返回非 Promise 的 SDK 实现
      await Promise.resolve(sandbox.kill()).catch(() => undefined);
    }
  }
}
