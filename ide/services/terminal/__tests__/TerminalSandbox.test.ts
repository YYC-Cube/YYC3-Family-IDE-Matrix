/**
 * @file: TerminalSandbox.test.ts
 * @description: 终端沙箱单测 — 白名单/黑名单/配额/超时/审计/双供应商适配器
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[terminal],[sandbox],[policy]
 */

import { describe, it, expect, vi } from "vitest";
import {
  TerminalService,
  SandboxPolicy,
  DryRunProvider,
  E2BProvider,
  CloudflareProvider,
  SandboxError,
  type E2BSDKLike,
  type CloudflareSDKLike,
} from "../index";

type PolicyConfig = ConstructorParameters<typeof SandboxPolicy>[0];

function makePolicy(overrides: Partial<PolicyConfig> = {}): SandboxPolicy {
  return new SandboxPolicy({
    allowedCommands: ["echo", "sleep", "false", "ls", "cat", "node", "pnpm"],
    blockedPatterns: [
      /rm\s+-rf/,
      /\bcc\b|--config/,
      /curl[^|]*\|\s*(ba)?sh/,
      /:\(\)\{.*\};:/,
      />\s*\/dev\/sd/,
    ],
    session: { maxCommands: 3, windowMs: 60_000 },
    defaultTimeoutMs: 200,
    maxTimeoutMs: 1_000,
    ...overrides,
  } as PolicyConfig);
}

function makeService(policyOrConfig: SandboxPolicy | Partial<PolicyConfig> = {}) {
  const policy =
    policyOrConfig instanceof SandboxPolicy
      ? policyOrConfig
      : makePolicy(policyOrConfig);
  const service = new TerminalService({ policy, defaultProvider: "dry-run" });
  service.registerProvider(new DryRunProvider());
  return { service, policy };
}

// 说明：超时用例以真实时钟验证（默认 200ms / 150ms 量级，无需 fake timers；
// 全局 fake timers 的时钟泵会干扰多 await 的供应商适配器链路）

describe("SandboxPolicy 策略层", () => {
  it("白名单外命令被拒绝", () => {
    const policy = makePolicy();
    expect(policy.check("curl").verdict).toBe("denied");
    expect(policy.check("echo").verdict).toBe("allowed");
  });

  it("黑名单模式优先于白名单（完整命令行匹配）", () => {
    const policy = makePolicy({ allowedCommands: "*" });
    // 命令名无威胁：放行
    expect(policy.check("rm").verdict).toBe("allowed");
    // 完整命令行命中危险模式：拒绝
    const denied = policy.check("rm", "rm -rf /");
    expect(denied.verdict).toBe("denied");
    expect(denied.reason).toContain("blocked pattern");
  });

  it("会话配额滑动窗口计数与重置", () => {
    const policy = makePolicy();
    expect(policy.isWithinQuota("s1")).toBe(true);
    policy.recordUsage("s1");
    policy.recordUsage("s1");
    expect(policy.getSessionStats("s1").commandsInWindow).toBe(2);
    expect(policy.isWithinQuota("s1")).toBe(true);
    policy.recordUsage("s1");
    expect(policy.isWithinQuota("s1")).toBe(false);

    policy.resetQuota("s1");
    expect(policy.isWithinQuota("s1")).toBe(true);
  });

  it("超时解析：下限 100ms、上限截断", () => {
    const policy = makePolicy();
    expect(policy.resolveTimeout()).toBe(200);
    expect(policy.resolveTimeout(10)).toBe(100);
    expect(policy.resolveTimeout(99_999)).toBe(1_000);
  });

  it("审计日志环形上限与倒序读取", () => {
    const policy = makePolicy();
    for (let i = 0; i < 520; i++) {
      policy.audit({ sessionKey: "s", command: `c${i}`, outcome: "executed" });
    }
    const log = policy.getAuditLog(10);
    expect(log).toHaveLength(10);
    expect(log[0].command).toBe("c519"); // 新→旧
  });
});

describe("TerminalService 执行管线", () => {
  it("白名单命令经 DryRun 执行并审计 executed", async () => {
    const { service, policy } = makeService();
    const result = await service.execute("s1", { command: "echo", args: ["你好"] });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("你好");

    const log = policy.getAuditLog();
    expect(log[0]).toMatchObject({ outcome: "executed", provider: "dry-run" });
  });

  it("拒绝命令抛 SandboxError(126) 并审计 denied", async () => {
    const { service, policy } = makeService();
    await expect(
      service.execute("s1", { command: "wget", args: ["http://x"] }),
    ).rejects.toMatchObject({ name: "SandboxError", exitCode: 126 });
    expect(policy.getAuditLog()[0].outcome).toBe("denied");
  });

  it("黑名单危险串拒绝（即使命令名在白名单）", async () => {
    const { service, policy } = makeService({ allowedCommands: [...["echo","sleep","false","ls","cat","node","pnpm"], "bash"] });
    await expect(
      service.execute("s1", { command: "bash", args: ["-c", "rm -rf /"] }),
    ).rejects.toMatchObject({ exitCode: 126 });
    expect(policy.getAuditLog()[0].reason).toContain("blocked pattern");
  });

  it("配额耗尽抛 SandboxError(129) 并审计 quota-blocked", async () => {
    const { service, policy } = makeService({ session: { maxCommands: 2, windowMs: 60_000 } });
    await service.execute("s1", { command: "echo", args: ["1"] });
    await service.execute("s1", { command: "echo", args: ["2"] });
    await expect(service.execute("s1", { command: "echo", args: ["3"] })).rejects.toMatchObject(
      { exitCode: 129 },
    );
    expect(policy.getAuditLog()[0].outcome).toBe("quota-blocked");
  });

  it("超时被终止：exit 124 + timedOut + 审计 timeout", async () => {
    const { service, policy } = makeService();
    const result = await service.execute("s1", { command: "sleep", args: ["5"], timeoutMs: 150 });
    expect(result.exitCode).toBe(124);
    expect(result.timedOut).toBe(true);
    expect(policy.getAuditLog()[0].outcome).toBe("timeout");
  });

  it("未注册供应商抛 SandboxError(127)", async () => {
    const { service } = makeService();
    await expect(
      service.execute("s1", { command: "echo" }, "nonexistent"),
    ).rejects.toMatchObject({ exitCode: 127 });
  });

  it("供应商执行异常转为 exec-failed 结果而非抛出", async () => {
    const { service, policy } = makeService();
    const result = await service.execute("s1", { command: "false" });
    expect(result.exitCode).toBe(1);
    expect(policy.getAuditLog()[0].outcome).toBe("exec-failed");
  });
});

describe("托管沙箱适配器（DI 假 SDK）", () => {
  it("E2BProvider 映射 SDK 结果并回收沙箱", async () => {
    const kill = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: "hello",
      stderr: "",
    });
    const create = vi.fn().mockResolvedValue({
      commands: { run },
      kill,
    });
    const sdk: E2BSDKLike = { Sandbox: { create } };

    const provider = new E2BProvider({ sdk });
    const result = await provider.execute({ command: "echo", args: ["hello"], workdir: "/w" });

    expect(result).toMatchObject({ exitCode: 0, stdout: "hello" });
    expect(run).toHaveBeenCalledWith("echo hello", { cwd: "/w", timeoutMs: undefined });
    expect(kill).toHaveBeenCalled();
  });

  it("CloudflareProvider 映射 SDK 结果并 dispose", async () => {
    const dispose = vi.fn().mockResolvedValue(undefined);
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "cf", stderr: "" });
    const create = vi.fn().mockResolvedValue({ commands: { run }, dispose });
    const sdk: CloudflareSDKLike = { Sandbox: { create } };

    const provider = new CloudflareProvider(sdk);
    const result = await provider.execute({ command: "echo", args: ["cf"] });

    expect(result.stdout).toBe("cf");
    expect(dispose).toHaveBeenCalled();
  });

  it("TerminalService 可切换默认供应商（双供应商抽象）", async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "e2b-ok", stderr: "" });
    const create = vi.fn().mockResolvedValue({ commands: { run }, kill: vi.fn().mockResolvedValue(undefined) });
    const { service } = makeService();
    service.registerProvider(new E2BProvider({ sdk: { Sandbox: { create } } }), true);

    const result = await service.execute("s2", { command: "echo", args: ["x"] });
    expect(result.stdout).toBe("e2b-ok");
  });
});

describe("审计修复回归（H1 元字符闸门 / M5 超时透传）", () => {
  it("参数含 shell 元字符一律拒绝（; | & $ ` < > ( ) 换行）", () => {
    const { service } = makeService({ allowedCommands: "*" });
    const cases = [
      ["echo", ["x; rm -rf /"]],
      ["echo", ["a && node -e 'evil'"]],
      ["echo", ["a | sh"]],
      ["echo", ["$(curl evil.sh)"]],
      ["echo", ["`curl evil.sh`"]],
      ["echo", ["a > /etc/passwd"]],
      ["echo", ["a\nrm -rf /"]],
      ["echo", ["(cd / && ls)"]],
    ] as const;
    for (const [command, args] of cases) {
      expect(
        service.execute("audit-s", { command, args: [...args] }),
      ).rejects.toMatchObject({ exitCode: 126 });
    }
  });

  it("合法含空格参数不受影响", async () => {
    const { service } = makeService({ allowedCommands: "*" });
    const result = await service.execute("audit-s", {
      command: "echo",
      args: ["hello world", "with spaces"],
    });
    expect(result.exitCode).toBe(0);
  });

  it("工厂默认白名单不再包含 node/npm/pnpm/git（审计 H1 收紧）", async () => {
    const { createTerminalService } = await import("../createTerminalService");
    const { service } = await createTerminalService({ provider: "dry-run" });
    for (const cmd of ["node", "npm", "pnpm", "git"]) {
      await expect(
        service.execute("audit-s", { command: cmd, args: ["-v"] }),
      ).rejects.toMatchObject({ exitCode: 126 });
    }
  });

  it("黑名单增强：rm -fr / chmod 0777 / dd of=/dev/ / find -delete", async () => {
    // 断言对象为工厂默认策略（SANDBOX_POLICY_DEFAULTS）而非测试本地 makePolicy
    const { SANDBOX_POLICY_DEFAULTS } = await import("../createTerminalService");
    const policy = new SandboxPolicy({
      allowedCommands: "*",
      blockedPatterns: SANDBOX_POLICY_DEFAULTS.blockedPatterns,
      session: { maxCommands: 5, windowMs: 60_000 },
    });
    expect(policy.check("rm", "rm -fr /").verdict).toBe("denied");
    expect(policy.check("chmod", "chmod 0777 /tmp").verdict).toBe("denied");
    expect(policy.check("dd", "dd if=x of=/dev/sda").verdict).toBe("denied");
    expect(policy.check("find", "find / -name x -delete").verdict).toBe("denied");
  });

  it("解析后的超时注入供应商请求（原生 timeout 透传）", async () => {
    const run = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    const create = vi.fn().mockResolvedValue({
      commands: { run },
      kill: vi.fn().mockResolvedValue(undefined),
    });
    const policy = new SandboxPolicy({
      allowedCommands: ["echo"],
      session: { maxCommands: 5, windowMs: 60_000 },
      defaultTimeoutMs: 7_500,
      maxTimeoutMs: 10_000,
    });
    const service = new TerminalService({ policy, defaultProvider: "e2b" });
    const { E2BProvider } = await import("../providers/E2BProvider");
    service.registerProvider(new E2BProvider({ sdk: { Sandbox: { create } } }));
    service.registerProvider(new DryRunProvider());

    await service.execute("s", { command: "echo", args: ["x"] });
    // run 收到解析后的 7.5s（而非请求缺省），create 亦带 apiKey 透传位
    expect(run).toHaveBeenCalledWith("echo x", { cwd: undefined, timeoutMs: 7_500 });
  });
});
