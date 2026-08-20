/**
 * @file: createTerminalService.ts
 * @description: 终端服务异步工厂 — 按 env/显式配置注入 E2B/Cloudflare 真实沙箱，
 *               SDK 未安装或初始化失败时优雅回退 DryRun（降级不阻断）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[factory],[config]
 *
 * brief: 增强②真实沙箱 SDK 注入 —— DI 适配器 + 动态 import + 降级链
 *
 * usage:
 * ```ts
 * // 默认：读 VITE_SANDBOX_PROVIDER / VITE_E2B_API_KEY 等 env
 * const { service, provider, degraded } = await createTerminalService();
 *
 * // 显式注入（服务端场景/测试）
 * const r = await createTerminalService({
 *   provider: "e2b",
 *   sdkLoader: () => import("e2b"),
 *   apiKey: process.env.E2B_API_KEY,
 * });
 * ```
 *
 * env 约定：
 *   VITE_SANDBOX_PROVIDER = "e2b" | "cloudflare" | "dry-run"（缺省 dry-run）
 *   VITE_E2B_API_KEY / VITE_CF_SANDBOX_API_KEY — 对应供应商密钥
 */

import { logger } from "../logger";
import { TerminalService } from "./TerminalService";
import { SandboxPolicy } from "./policy";
import { DryRunProvider } from "./providers/DryRunProvider";
import { E2BProvider, type E2BSDKLike } from "./providers/E2BProvider";
import {
  CloudflareProvider,
  type CloudflareSDKLike,
} from "./providers/CloudflareProvider";
import type { SandboxProvider } from "./types";

export type SandboxProviderKind = "e2b" | "cloudflare" | "dry-run";

export interface SandboxServiceConfig {
  provider: SandboxProviderKind;
  /** 供应商 API Key（e2b/cloudflare） */
  apiKey?: string;
  /** SDK 加载器 —— 缺省动态 import 对应包（未安装时回退 DryRun） */
  sdkLoader?: () => Promise<unknown>;
  /** 策略配置覆盖（白名单/配额/超时） */
  policy?: Partial<ConstructorParameters<typeof SandboxPolicy>[0]>;
}

export interface TerminalServiceFactoryResult {
  service: TerminalService;
  /** 实际生效的供应商名（降级时为 "dry-run"） */
  provider: string;
  /** 是否发生降级（真实供应商不可用 → DryRun） */
  degraded: boolean;
}

/**
 * 默认沙箱策略（审计 H2/H1 收紧后）：
 * - 白名单仅保留展示型/只读命令 —— node/npm/pnpm/git 可执行任意脚本，已移除，
 *   需要时经 config.policy 显式加回并自担风险
 * - 黑名单覆盖直接破坏形态（配合元字符闸门形成双层）
 */
export const SANDBOX_POLICY_DEFAULTS: Partial<
  ConstructorParameters<typeof SandboxPolicy>[0]
> = {
  allowedCommands: [
    "echo", "ls", "cat", "head", "tail", "grep", "find", "pwd", "which",
    "mkdir", "touch", "false", "sleep", "clear",
  ],
  blockedPatterns: [
    /\brm\s+-\w*r/,            // rm -r/-rf/-fr（任意含 r 的旗标组合）
    /\bchmod\s+0?777\b/,
    /\bmkfs\b/,
    /\bdd\s+[^;]*of=\/dev\//,  // dd 写设备
    /\bfind\s+[^;]*-delete\b/,
    /curl[^|]*\|\s*(ba)?sh/,
    /wget[^|]*\|\s*(ba)?sh/,
    /:\(\)\{.*\};:/,
    />\s*\/dev\/sd/,
  ],
  session: { maxCommands: 60, windowMs: 60_000 },
  defaultTimeoutMs: 10_000,
  maxTimeoutMs: 30_000,
};

/** 从 Vite env 解析配置（缺省 dry-run，零配置可用） */
export function resolveSandboxConfigFromEnv(
  env: Record<string, string | undefined> = {},
): SandboxServiceConfig {
  const provider = env.VITE_SANDBOX_PROVIDER;
  return {
    provider:
      provider === "e2b" || provider === "cloudflare" ? provider : "dry-run",
    apiKey:
      provider === "e2b"
        ? env.VITE_E2B_API_KEY
        : provider === "cloudflare"
          ? env.VITE_CF_SANDBOX_API_KEY
          : undefined,
  };
}

/**
 * 创建终端服务：策略闸门 + 请求的沙箱供应商（不可用时降级 DryRun）。
 */
export async function createTerminalService(
  config?: SandboxServiceConfig,
): Promise<TerminalServiceFactoryResult> {
  const resolved: SandboxServiceConfig =
    config ??
    resolveSandboxConfigFromEnv(
      ((import.meta as unknown as { env?: Record<string, string> }).env ?? {}),
    );

  const policy = new SandboxPolicy({
    ...SANDBOX_POLICY_DEFAULTS,
    ...resolved.policy,
    session: resolved.policy?.session ?? SANDBOX_POLICY_DEFAULTS.session!,
  } as ConstructorParameters<typeof SandboxPolicy>[0]);

  const service = new TerminalService({
    policy,
    defaultProvider: "dry-run",
  });
  service.registerProvider(new DryRunProvider());

  if (resolved.provider === "dry-run") {
    return { service, provider: "dry-run", degraded: false };
  }

  // 真实供应商：动态加载 SDK，任何失败降级 DryRun（不阻断启动）
  try {
    const provider = await loadRealProvider(resolved);
    if (provider) {
      service.registerProvider(provider, true);
      logger.warn(`[Terminal] sandbox provider "${provider.name}" active`);
      return { service, provider: provider.name, degraded: false };
    }
  } catch (error) {
    logger.error("[Terminal] sandbox SDK init failed:", error);
  }

  logger.warn(
    `[Terminal] sandbox provider "${resolved.provider}" unavailable — degraded to dry-run`,
  );
  return { service, provider: "dry-run", degraded: true };
}

async function loadRealProvider(
  config: SandboxServiceConfig,
): Promise<SandboxProvider | null> {
  if (config.provider === "e2b") {
    // 变量 + @vite-ignore：可选依赖不参与构建期解析（未安装时运行时抛错→降级）
    const E2B_MODULE = "e2b";
    const loader =
      config.sdkLoader ??
      ((): Promise<unknown> => import(/* @vite-ignore */ E2B_MODULE));
    const mod = (await loader()) as Partial<E2BSDKLike>;
    if (typeof mod?.Sandbox?.create === "function") {
      return new E2BProvider({
        sdk: { Sandbox: mod.Sandbox },
        // env 密钥仅作为 SDK 运行参数传递，绝不落盘 localStorage（审计 H2）
        apiKey: config.apiKey,
      });
    }
    return null;
  }

  const CF_MODULE = "@cloudflare/sandbox";
  const loader =
    config.sdkLoader ??
    ((): Promise<unknown> => import(/* @vite-ignore */ CF_MODULE));
  const mod = (await loader()) as Partial<CloudflareSDKLike>;
  if (typeof mod?.Sandbox?.create === "function") {
    return new CloudflareProvider({ Sandbox: mod.Sandbox });
  }
  return null;
}
