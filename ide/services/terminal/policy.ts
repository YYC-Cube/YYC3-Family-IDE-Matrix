/**
 * @file: policy.ts
 * @description: 沙箱策略层 — 命令白名单/黑名单模式/会话配额/审计日志
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [terminal],[sandbox],[policy],[audit]
 *
 * brief: 批③决策二的本地策略层 —— 托管沙箱 API 之前的第一道闸门
 *
 * details:
 * - 黑名单模式优先于白名单（危险命令无论是否在白名单都拒绝）
 * - 会话配额：滑动窗口内 maxCommands 条（默认 60s / 30 条）
 * - 审计日志环形上限 500 条，供运维面板消费
 */

import type {
  AuditEntry,
  AuditOutcome,
  PolicyDecision,
  SandboxPolicyConfig,
} from "./types";

const AUDIT_LIMIT = 500;
// ── Phase 2 P2-4 审计持久化（IndexedDB append-only）──

const AUDIT_DB_NAME = "yyc3_terminal_audit";
const AUDIT_STORE = "audit_log";
let auditDBPromise: Promise<IDBDatabase> | null = null;

function getAuditDB(): Promise<IDBDatabase> {
  if (auditDBPromise) return auditDBPromise;
  auditDBPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(AUDIT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(AUDIT_STORE)) {
        db.createObjectStore(AUDIT_STORE, { keyPath: "seq", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return auditDBPromise;
}

async function persistAuditEntry(entry: AuditEntry): Promise<void> {
  const db = await getAuditDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIT_STORE, "readwrite");
    tx.objectStore(AUDIT_STORE).add(entry); // append-only（autoIncrement key）
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


/** shell 元字符（审计 H1）：出现在完整命令行即拒绝 */
const SHELL_METACHAR_RE = /[;|&$`<>()\r\n]/;

export class SandboxPolicy {
  private config: Required<
    Pick<SandboxPolicyConfig, "defaultTimeoutMs" | "maxTimeoutMs">
  > &
    SandboxPolicyConfig;
  private usage = new Map<string, number[]>();
  private auditLog: AuditEntry[] = [];

  constructor(config: SandboxPolicyConfig) {
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 10_000,
      maxTimeoutMs: config.maxTimeoutMs ?? 60_000,
      ...config,
    };
  }

  /**
   * 命令准入检查：黑名单模式优先（匹配完整命令行，含参数），其次白名单
   * @param name 命令名（白名单匹配）
   * @param fullCommand 完整命令行（黑名单正则匹配；缺省用 name）
   */
  check(name: string, fullCommand?: string): PolicyDecision {
    const line = fullCommand ?? name;

    // 审计 H1 修复：参数中出现 shell 元字符一律拒绝（`;|&$\\`<>()` 换行/回车）。
    // 白名单只校验命令名，元字符可借参数注入任意命令（如 echo "x"; rm -rf /），
    // 因此这是比黑名单更前置的硬闸门；引号包裹的元字符同样拒绝（从严）。
    if (SHELL_METACHAR_RE.test(line)) {
      return {
        verdict: "denied",
        reason: "shell metacharacters in command line are not allowed",
      };
    }

    for (const pattern of this.config.blockedPatterns ?? []) {
      if (pattern.test(line)) {
        return {
          verdict: "denied",
          reason: `matched blocked pattern: ${pattern.source}`,
        };
      }
    }

    if (this.config.allowedCommands !== "*") {
      if (!this.config.allowedCommands.includes(name)) {
        return {
          verdict: "denied",
          reason: `command not in allowlist: ${name}`,
        };
      }
    }

    return { verdict: "allowed" };
  }

  /** 解析本次执行超时（截断到上限） */
  resolveTimeout(requestedMs?: number): number {
    const raw = requestedMs ?? this.config.defaultTimeoutMs;
    return Math.min(Math.max(raw, 100), this.config.maxTimeoutMs);
  }

  /** 会话配额检查（不记账；记账由 recordUsage 完成） */
  isWithinQuota(sessionKey: string, now = Date.now()): boolean {
    const { maxCommands, windowMs } = this.config.session;
    const stamps = (this.usage.get(sessionKey) ?? []).filter(
      (t) => now - t < windowMs,
    );
    this.usage.set(sessionKey, stamps);
    return stamps.length < maxCommands;
  }

  /** 记一次配额内使用 */
  recordUsage(sessionKey: string, now = Date.now()): void {
    const stamps = this.usage.get(sessionKey) ?? [];
    stamps.push(now);
    this.usage.set(sessionKey, stamps);
  }

  /** 写审计（Phase 2 P2-4：内存环形 + IndexedDB append-only 双写） */
  audit(entry: Omit<AuditEntry, "timestamp">): void {
    const full: AuditEntry = { ...entry, timestamp: Date.now() };

    // 1) 内存环形（原有——低延迟查询）
    this.auditLog.push(full);
    if (this.auditLog.length > AUDIT_LIMIT) {
      this.auditLog.splice(0, this.auditLog.length - AUDIT_LIMIT);
    }

    // 2) IndexedDB 持久化（异步、append-only、不阻塞主线程）
    void persistAuditEntry(full).catch(() => {
      // 持久化失败不阻断命令执行（审计降级：仅内存）
    });
  }

  /**
   * 从 IndexedDB 读取持久化审计日志（Phase 2 P2-4）
   * 刷新/重启后仍可查询——满足安全合规「不可抵赖」要求
   */
  async getPersistentAuditLog(limit = 200): Promise<AuditEntry[]> {
    try {
      const db = await getAuditDB();
      const tx = db.transaction(AUDIT_STORE, "readonly");
      const store = tx.objectStore(AUDIT_STORE);
      const count = await new Promise<number>((res, rej) => { const r = store.count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const start = Math.max(0, count - limit);
      const results = await store.getAll(IDBKeyRange.bound(start, count));
      const entries = (results as unknown) as AuditEntry[];
      return entries.reverse(); // 新→旧
    } catch {
      return []; // IndexedDB 不可用时返回空
    }
  }

  /** 读取审计日志（新→旧） */
  getAuditLog(limit = 100): AuditEntry[] {
    return this.auditLog.slice(-limit).reverse();
  }

  /** 会话用量统计（运维面板用） */
  getSessionStats(sessionKey: string, now = Date.now()): {
    commandsInWindow: number;
    windowMs: number;
    maxCommands: number;
  } {
    const stamps = (this.usage.get(sessionKey) ?? []).filter(
      (t) => now - t < this.config.session.windowMs,
    );
    return {
      commandsInWindow: stamps.length,
      windowMs: this.config.session.windowMs,
      maxCommands: this.config.session.maxCommands,
    };
  }

  /** 清空某会话或全部配额记录 */
  resetQuota(sessionKey?: string): void {
    if (sessionKey) this.usage.delete(sessionKey);
    else this.usage.clear();
  }
}
