/**
 * @file: DryRunProvider.ts
 * @description: 干跑沙箱供应商 — 本地模拟执行，用于开发/测试/演示
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[dry-run]
 */

import type { CommandRequest, ExecResult, SandboxProvider } from "../types";

/**
 * DryRunProvider —— 不接触任何真实系统：
 * - `echo ...` → 回显参数
 * - `sleep N` → 真实等待 N 秒（受 abort 中断，用于验证超时链路）
 * - `false` → exit 1（验证失败路径）
 * - 其余 → exit 0，stdout 标注 dry-run 前缀
 */
export class DryRunProvider implements SandboxProvider {
  readonly name = "dry-run";

  async execute(
    request: CommandRequest,
    signal?: AbortSignal,
  ): Promise<ExecResult> {
    const start = Date.now();
    const full = [request.command, ...(request.args ?? [])].join(" ");

    if (request.command === "sleep") {
      const seconds = Number(request.args?.[0] ?? 1);
      await abortableDelay(seconds * 1000, signal);
      return {
        exitCode: signal?.aborted ? 124 : 0,
        stdout: "",
        stderr: "",
        durationMs: Date.now() - start,
        timedOut: signal?.aborted,
      };
    }

    let exitCode = 0;
    let stdout = `[dry-run] ${full}`;

    if (request.command === "echo") {
      stdout = (request.args ?? []).join(" ");
    } else if (request.command === "false") {
      exitCode = 1;
      stdout = "";
    }

    return {
      exitCode,
      stdout,
      stderr: "",
      durationMs: Date.now() - start,
    };
  }
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, Math.max(0, ms));
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
