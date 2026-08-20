/**
 * @file: TerminalPanel.tsx
 * @description: 终端面板 — XTerminal × TerminalService 沙箱闸门的 REPL 接线
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[panel],[sandbox],[repl]
 *
 * brief: 批③决策二的消费端 —— 每条命令经策略闸门（白名单/配额/超时/审计）
 *        后由注册的沙箱供应商执行；默认 DryRun 供应商（本地零风险）
 *
 * usage:
 * ```tsx
 * <TerminalPanel nodeId="n-term" />
 *
 * // 接入真实沙箱：
 * const service = new TerminalService({ policy, defaultProvider: "e2b" });
 * service.registerProvider(new E2BProvider({ sdk }));
 * <TerminalPanel nodeId="n-term" service={service} />
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelHeader } from "../panel-host";
import { XTerminal, type XTerminalHandle } from "./XTerminal";
import { XTERM_THEMES } from "../../utils/xterm-theme";
import {
  TerminalService,
  SandboxPolicy,
  DryRunProvider,
  SandboxError,
  type TerminalService as ITerminalService,
} from "../../services/terminal";
import { CircleAlert, CircleCheck } from "lucide-react";

/** 默认策略：常见只读/构建命令放行，危险模式一律拒绝 */
const DEFAULT_POLICY = new SandboxPolicy({
  allowedCommands: [
    "echo", "ls", "cat", "head", "tail", "grep", "find", "pwd", "which",
    "node", "npm", "pnpm", "git", "mkdir", "touch", "false", "sleep", "clear",
  ],
  blockedPatterns: [
    /rm\s+-rf/,
    /\bcc\b|\bchmod\s+777\b/,
    /curl[^|]*\|\s*(ba)?sh/,
    /wget[^|]*\|\s*(ba)?sh/,
    /:\(\)\{.*\};:/,
    />\s*\/dev\/sd/,
    /\bmkfs\b/,
  ],
  session: { maxCommands: 60, windowMs: 60_000 },
  defaultTimeoutMs: 10_000,
  maxTimeoutMs: 30_000,
});

/** 默认服务实例（DryRun）；接入托管沙箱时传入自建 service */
let defaultService: ITerminalService | null = null;
function getDefaultService(): ITerminalService {
  if (!defaultService) {
    defaultService = new TerminalService({
      policy: DEFAULT_POLICY,
      defaultProvider: "dry-run",
    });
    defaultService.registerProvider(new DryRunProvider());
  }
  return defaultService;
}

export interface TerminalPanelProps {
  nodeId: string;
  /** 会话键（配额/审计隔离单位） */
  sessionKey?: string;
  /** 注入的终端服务（默认 DryRun） */
  service?: ITerminalService;
}

const PROMPT = "\r\nyyc3 ❯ ";

export default function TerminalPanel({
  nodeId,
  sessionKey = "main",
  service = getDefaultService(),
}: TerminalPanelProps) {
  const handleRef = useRef<XTerminalHandle | null>(null);
  const bufferRef = useRef("");
  const busyRef = useRef(false);
  const [lastExit, setLastExit] = useState<number | null>(null);

  const write = useCallback((s: string) => handleRef.current?.write(s), []);

  const runCommand = useCallback(
    async (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        write(PROMPT);
        return;
      }
      if (trimmed === "clear") {
        handleRef.current?.clear();
        write("yyc3 ❯ ");
        return;
      }

      busyRef.current = true;
      const [command, ...args] = trimmed.split(/\s+/);
      try {
        const result = await service.execute(sessionKey, { command, args });
        setLastExit(result.exitCode);
        if (result.stdout) write(`\r\n${result.stdout.replace(/\n/g, "\r\n")}`);
        if (result.stderr) write(`\r\n\x1b[31m${result.stderr.replace(/\n/g, "\r\n")}\x1b[0m`);
        if (result.exitCode !== 0) {
          write(`\r\n\x1b[33mexit ${result.exitCode}${result.timedOut ? " (timeout)" : ""}\x1b[0m`);
        }
      } catch (error) {
        if (error instanceof SandboxError) {
          setLastExit(error.exitCode);
          write(`\r\n\x1b[31m${error.message}\x1b[0m`);
        } else {
          setLastExit(1);
          write(`\r\n\x1b[31m内部错误：${String(error)}\x1b[0m`);
        }
      } finally {
        busyRef.current = false;
        write(PROMPT);
      }
    },
    [service, sessionKey, write],
  );

  const handleData = useCallback(
    (data: string) => {
      if (busyRef.current) return; // 执行中忽略输入
      if (data === "\r") {
        const line = bufferRef.current;
        bufferRef.current = "";
        void runCommand(line);
        return;
      }
      if (data === "\u007f") {
        // 退格
        if (bufferRef.current.length > 0) {
          bufferRef.current = bufferRef.current.slice(0, -1);
          write("\b \b");
        }
        return;
      }
      if (data === "\u0003") {
        bufferRef.current = "";
        write("^C");
        write(PROMPT);
        return;
      }
      if (data >= " ") {
        bufferRef.current += data;
        write(data);
      }
    },
    [runCommand, write],
  );

  useEffect(() => {
    // onReady 之后输出欢迎语与提示符
    const t = setTimeout(() => {
      write("\x1b[36mYYC³ Terminal · sandboxed\x1b[0m — 命令经策略闸门执行（DryRun）");
      write(PROMPT);
    }, 150);
    return () => clearTimeout(t);
  }, [write]);

  return (
    <div className="panel-host-root size-full flex flex-col bg-[var(--ide-bg)]">
      <PanelHeader
        nodeId={nodeId}
        panelId="terminal"
        title="终端"
        icon={lastExit === 0 ? <CircleCheck className="w-3 h-3 text-emerald-400/80" /> : lastExit !== null ? <CircleAlert className="w-3 h-3 text-amber-400/80" /> : undefined}
      >
        <span className="text-[0.6rem] text-slate-500">
          session: {sessionKey}
        </span>
      </PanelHeader>
      <div className="flex-1 min-h-0 p-1">
        <XTerminal
          sessionId={`${nodeId}:${sessionKey}`}
          theme={XTERM_THEMES.cyberpunk ?? undefined}
          onData={handleData}
          onReady={(handle) => {
            handleRef.current = handle;
            handle.focus();
          }}
        />
      </div>
    </div>
  );
}
