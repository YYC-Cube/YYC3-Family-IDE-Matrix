/**
 * @file: SandboxedTerminal.test.tsx
 * @description: 沙箱化终端面板单测 — 异步工厂解析/供应商徽章/降级标记（xterm mock）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[terminal],[sandboxed],[hook]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

vi.mock("@xterm/xterm", () => {
  const instance: Record<string, unknown> = {};
  return {
    Terminal: vi.fn().mockImplementation(() => ({
      open: vi.fn(), write: vi.fn(), writeln: vi.fn(), clear: vi.fn(),
      focus: vi.fn(), onResize: vi.fn(), onTitleChange: vi.fn(),
      dispose: vi.fn(), loadAddon: vi.fn(),
      onData: vi.fn((cb: (d: string) => void) => {
        (instance as { __cb?: (d: string) => void }).__cb = cb;
      }),
      unicode: { activeVersion: "11" }, cols: 80, rows: 24,
    })),
  };
});
vi.mock("@xterm/addon-fit", () => ({ FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })) }));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: vi.fn().mockImplementation(() => ({})) }));
vi.mock("@xterm/addon-search", () => ({ SearchAddon: vi.fn().mockImplementation(() => ({})) }));
vi.mock("@xterm/addon-unicode11", () => ({ Unicode11Addon: vi.fn().mockImplementation(() => ({})) }));

// 只 mock 工厂模块（barrel 会 re-export 同一 mock 实例）
const factoryMock = vi.fn();
vi.mock("../../../services/terminal/createTerminalService", () => ({
  createTerminalService: (...args: unknown[]) => factoryMock(...args),
  resolveSandboxConfigFromEnv: vi.fn().mockReturnValue({ provider: "dry-run" }),
  SANDBOX_POLICY_DEFAULTS: {},
}));

import { SandboxedTerminalPanel, useSandboxedTerminalService } from "../TerminalPanel";
import type { TerminalService } from "../../../services/terminal";

function fakeService(name = "e2b"): TerminalService {
  return {
    execute: vi.fn().mockResolvedValue({
      exitCode: 0, stdout: `via-${name}`, stderr: "", durationMs: 1,
    }),
  } as unknown as TerminalService;
}

beforeEach(() => {
  factoryMock.mockReset();
});

describe("useSandboxedTerminalService / SandboxedTerminalPanel", () => {
  it("工厂解析前首帧即可渲染（DryRun 默认，无徽章闪烁崩溃）", async () => {
    factoryMock.mockReturnValue(new Promise(() => undefined)); // 永不解析
    render(<SandboxedTerminalPanel nodeId="n1" />);
    expect(document.querySelector("[data-panel-id='terminal']")).not.toBeNull();
  });

  it("env 配置真实供应商时解析后热切换并显示徽章", async () => {
    factoryMock.mockResolvedValue({
      service: fakeService("e2b"),
      provider: "e2b",
      degraded: false,
    });
    render(<SandboxedTerminalPanel nodeId="n1" sessionKey="s1" />);

    // 等待异步解析与渲染
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const badge = screen.getByTestId("sandbox-provider");
    expect(badge.textContent).toBe("e2b");
  });

  it("SDK 缺失降级时徽章显示 dry-run（降级）并保持琥珀色", async () => {
    factoryMock.mockResolvedValue({
      service: fakeService(),
      provider: "dry-run",
      degraded: true,
    });
    render(<SandboxedTerminalPanel nodeId="n1" sessionKey="s2" />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const badge = screen.getByTestId("sandbox-provider");
    expect(badge.textContent).toContain("降级");
    expect(badge.className).toContain("amber");
  });

  it("工厂拒绝时保持默认服务且不崩溃（ready 置位）", async () => {
    factoryMock.mockRejectedValue(new Error("factory boom"));
    let hookState: ReturnType<typeof useSandboxedTerminalService> | null = null;
    const Probe = () => {
      hookState = useSandboxedTerminalService();
      return null;
    };
    render(<Probe />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(hookState!.ready).toBe(true);
    expect(hookState!.provider).toBe("dry-run");
    expect(hookState!.service).toBeDefined();
  });
});
