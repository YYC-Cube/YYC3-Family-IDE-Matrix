/**
 * @file: enhancements.test.ts
 * @description: 增强②③单测 — 沙箱异步工厂（真实注入/降级）+ 协作配置解析
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[terminal],[collab],[config],[factory]
 */

import {
  createTerminalService,
  resolveSandboxConfigFromEnv,
} from "../createTerminalService";
import { DryRunProvider } from "../providers/DryRunProvider";

describe("增强②：沙箱服务工厂", () => {
  it("env 解析：缺省 dry-run，仅接受合法 provider 值", () => {
    expect(resolveSandboxConfigFromEnv({}).provider).toBe("dry-run");
    expect(
      resolveSandboxConfigFromEnv({ VITE_SANDBOX_PROVIDER: "e2b" }).provider,
    ).toBe("e2b");
    expect(
      resolveSandboxConfigFromEnv({ VITE_SANDBOX_PROVIDER: "evil" }).provider,
    ).toBe("dry-run");
    expect(
      resolveSandboxConfigFromEnv({
        VITE_SANDBOX_PROVIDER: "cloudflare",
        VITE_CF_SANDBOX_API_KEY: "cf-1",
      }).apiKey,
    ).toBe("cf-1");
  });

  it("dry-run 配置：工厂返回未降级的 DryRun 服务", async () => {
    const { service, provider, degraded } = await createTerminalService({
      provider: "dry-run",
    });
    expect(provider).toBe("dry-run");
    expect(degraded).toBe(false);
    const result = await service.execute("s", { command: "echo", args: ["ok"] });
    expect(result.stdout).toBe("ok");
  });

  it("E2B 注入：sdkLoader 提供假 SDK 时真实供应商生效", async () => {
    const fakeRun = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "e2b", stderr: "" });
    const fakeCreate = vi.fn().mockResolvedValue({
      commands: { run: fakeRun },
      kill: vi.fn().mockResolvedValue(undefined),
    });

    const { service, provider, degraded } = await createTerminalService({
      provider: "e2b",
      sdkLoader: () =>
        Promise.resolve({ Sandbox: { create: fakeCreate } }),
    });

    expect(provider).toBe("e2b");
    expect(degraded).toBe(false);

    const result = await service.execute("s", { command: "echo", args: ["x"] });
    expect(result.stdout).toBe("e2b");
    expect(fakeRun).toHaveBeenCalled();
  });

  it("SDK 未安装（动态 import 失败）→ 优雅降级 DryRun", async () => {
    const { service, provider, degraded } = await createTerminalService({
      provider: "e2b",
      sdkLoader: () => Promise.reject(new Error("MODULE_NOT_FOUND")),
    });
    expect(provider).toBe("dry-run");
    expect(degraded).toBe(true);
    // 降级后服务仍可用
    const result = await service.execute("s", { command: "echo", args: ["fallback"] });
    expect(result.stdout).toBe("fallback");
  });

  it("SDK 加载成功但缺少 Sandbox.create → 同样降级", async () => {
    const { provider, degraded } = await createTerminalService({
      provider: "cloudflare",
      sdkLoader: () => Promise.resolve({ SomethingElse: true }),
    });
    expect(provider).toBe("dry-run");
    expect(degraded).toBe(true);
  });

  it("策略配置覆盖生效（自定义白名单）", async () => {
    const { service } = await createTerminalService({
      provider: "dry-run",
      policy: { allowedCommands: ["echo"], session: { maxCommands: 1, windowMs: 60_000 } },
    });
    await service.execute("s", { command: "echo", args: ["1"] });
    await expect(service.execute("s", { command: "echo", args: ["2"] })).rejects.toMatchObject(
      { exitCode: 129 },
    );
  });
});
