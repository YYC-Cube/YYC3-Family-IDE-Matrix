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
  createTerminalService,
  SANDBOX_POLICY_DEFAULTS,
  type TerminalService as ITerminalService,
} from "../../services/terminal";
import { CircleAlert, CircleCheck } from "lucide-react";

/** 默认服务实例（DryRun）；接入托管沙箱时传入自建 service */
/** 默认面板服务：工厂默认策略（单一真相源 SANDBOX_POLICY_DEFAULTS）+ DryRun */
let defaultServicePromise: Promise<ITerminalService> | null = null;
const serviceRef: { current: ITerminalService | null } = { current: null };

function getDefaultService(): ITerminalService {
  if (!serviceRef.current) {
    const policy = new SandboxPolicy({
      ...SANDBOX_POLICY_DEFAULTS,
      session: SANDBOX_POLICY_DEFAULTS.session!,
    } as ConstructorParameters<typeof SandboxPolicy>[0]);
    const service = new TerminalService({ policy, defaultProvider: "dry-run" });
    service.registerProvider(new DryRunProvider());
    serviceRef.current = service;
  }
  return serviceRef.current;
}

/** 异步版本：经工厂支持真实沙箱 env 注入（增强②入口） */
export function getDefaultSandboxedService(): Promise<ITerminalService> {
  defaultServicePromise ??= createTerminalService().then((r) => r.service);
  return defaultServicePromise;
}

/** 沙箱化终端面板状态（useSandboxedTerminalService 返回） */
export interface SandboxedTerminalState {
  /** 生效服务（解析前为 DryRun 默认；env 配置真实供应商时热切换） */
  service: ITerminalService;
  /** 实际供应商名 */
  provider: string;
  /** 是否降级（真实供应商不可用 → DryRun） */
  degraded: boolean;
  /** 异步工厂是否已解析 */
  ready: boolean;
}

/**
 * 沙箱化终端服务 Hook（组装期默认入口）：
 * 首帧同步给 DryRun 默认（零延迟可输入），异步工厂解析后按 env 配置
 * 热切换到 E2B/Cloudflare 真实沙箱；降级时保持 DryRun 并标记。
 */
export function useSandboxedTerminalService(): SandboxedTerminalState {
  const [state, setState] = useState<SandboxedTerminalState>(() => ({
    service: getDefaultService(),
    provider: "dry-run",
    degraded: false,
    ready: false,
  }));

  useEffect(() => {
    let alive = true;
    createTerminalService()
      .then((result) => {
        if (!alive) return;
        setState({
          service: result.service,
          provider: result.provider,
          degraded: result.degraded,
          ready: true,
        });
      })
      .catch(() => {
        // 工厂异常不阻断面板：保持 DryRun 默认
        if (alive) setState((prev) => ({ ...prev, ready: true }));
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/**
 * 沙箱化终端面板（组装期默认组件）：
 * 自动按 env（VITE_SANDBOX_PROVIDER 等）接入真实沙箱，头部显示供应商徽章。
 */
export function SandboxedTerminalPanel({
  nodeId,
  sessionKey = "main",
}: {
  nodeId: string;
  sessionKey?: string;
}) {
  const { service, provider, degraded } = useSandboxedTerminalService();
  return (
    <TerminalPanel
      nodeId={nodeId}
      sessionKey={sessionKey}
      service={service}
      providerLabel={degraded ? `${provider} → dry-run（降级）` : provider}
    />
  );
}

export interface TerminalPanelProps {
  nodeId: string;
  /** 会话键（配额/审计隔离单位） */
  sessionKey?: string;
  /** 注入的终端服务（默认 DryRun） */
  service?: ITerminalService;
  /** 供应商徽章文本（如 "e2b" / "e2b → dry-run（降级）"） */
  providerLabel?: string;
}

const PROMPT = "\r\nyyc3 ❯ ";

export default function TerminalPanel({
  nodeId,
  sessionKey = "main",
  service = getDefaultService(),
  providerLabel,
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
          {providerLabel && (
            <span
              className={`mr-1 rounded px-1 ${providerLabel.includes("降级") ? "bg-amber-900/40 text-amber-400" : "bg-cyan-900/40 text-cyan-400"}`}
              data-testid="sandbox-provider"
            >
              {providerLabel}
            </span>
          )}
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
