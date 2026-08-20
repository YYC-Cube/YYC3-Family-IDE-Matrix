/**
 * @file: CloudflareProvider.ts
 * @description: Cloudflare Sandbox 适配器（批③决策二双供应商路线，2026-04 GA）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[cloudflare],[adapter]
 *
 * brief: SDK 依赖注入的最小适配层 —— 与 E2BProvider 实现同一 SandboxProvider
 *
 * usage:
 * ```ts
 * import { Sandbox } from "@cloudflare/sandbox";
 * const provider = new CloudflareProvider({ Sandbox });
 * ```
 */

import type { CommandRequest, ExecResult, SandboxProvider } from "../types";

/** Cloudflare Sandbox SDK 的最小结构类型 */
export interface CloudflareSDKLike {
  Sandbox: {
    create(options?: { timeoutMs?: number }): Promise<CloudflareSandboxLike>;
  };
}

export interface CloudflareSandboxLike {
  commands: {
    run(
      command: string,
      options?: { timeoutMs?: number; workdir?: string },
    ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
  };
  dispose?(): Promise<void>;
}

export class CloudflareProvider implements SandboxProvider {
  readonly name = "cloudflare";
  constructor(private readonly sdk: CloudflareSDKLike) {}

  async execute(
    request: CommandRequest,
    _signal?: AbortSignal,
  ): Promise<ExecResult> {
    const start = Date.now();
    const full = [request.command, ...(request.args ?? [])].join(" ");
    const sandbox = await this.sdk.Sandbox.create();

    try {
      const result = await sandbox.commands.run(full, {
        workdir: request.workdir,
      });
      return {
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - start,
      };
    } finally {
      await sandbox.dispose?.().catch(() => undefined);
    }
  }
}
