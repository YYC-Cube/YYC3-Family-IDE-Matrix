/**
 * @file: APIKeyVault.methods.test.ts
 * @description: APIKeyVault 方法面测试 — Phase 1 P1-6（jsdom 无 idb，以方法签名+掩码+状态面为主）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-28
 * @updated: 2026-08-28
 * @status: active
 * @tags: [test],[security],[vault]
 */

import { describe, it, expect } from "vitest";
import { apiKeyVault, PROVIDERS } from "../APIKeyVault";

describe("APIKeyVault · 方法面", () => {
  // ── PROVIDERS 元数据 ──
  it("PROVIDERS 导出完整的服务商元数据", () => {
    const ids = Object.keys(PROVIDERS);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    ids.forEach((id) => {
      const p = PROVIDERS[id as keyof typeof PROVIDERS];
      expect(p).toBeTruthy();
      expect(p).toMatchObject({
        name: expect.any(String),
        docsUrl: expect.any(String),
      });
    });
  });

  // ── maskKey（纯函数，无 idb 依赖）──
  it("maskKey 掩码完整密钥", () => {
    const masked = apiKeyVault.maskKey("sk-very-secret-key-abcdef123456");
    expect(masked).not.toBe("sk-very-secret-key-abcdef123456");
    expect(masked).toContain("*");
    // 保留前缀和末尾少量字符
    expect(masked.startsWith("sk")).toBe(true);
  });

  it("maskKey 短密钥全掩码", () => {
    const masked = apiKeyVault.maskKey("abc");
    expect(masked).not.toBe("abc");
    expect(masked).toMatch(/^\*+$/);
  });

  it("maskKey 空串安全返回", () => {
    expect(apiKeyVault.maskKey("")).toBe("****");
  });

  // ── validateKey（纯函数）──
  it("validateKey 校验密钥格式", () => {
    // 用 custom provider 避开 keyPattern 依赖
    const valid = apiKeyVault.validateKey("custom" as never, "any-format-key");
    expect(valid.valid).toBe(true);

    const empty = apiKeyVault.validateKey("custom" as never, "");
    expect(empty.valid).toBe(false);
    expect(empty.error).toContain("不能为空");
  });

  it("validateKey 空 key 无效", () => {
    const result = apiKeyVault.validateKey("custom" as never, "");
    expect(result.valid).toBe(false);
  });

  // ── 方法签名契约（运行时行为需真浏览器 idb）──
  it("所有公开方法签名完整", () => {
    const methods = [
      "init", "maskKey", "validateKey", "saveKey",
      "getKey", "getActiveKey", "listKeys", "deleteKey",
      "setActive", "clearAll", "exportConfig",
    ];
    methods.forEach((name) => {
      expect(typeof (apiKeyVault as unknown as Record<string, unknown>)[name]).toBe("function");
    });
  });

  // ── 源码 tripwire：setActive 不走 listKeys（H3 修复回归）──
  it("setActive 实现直读库内原始记录（审计 H3 源码 tripwire）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const code = fs.readFileSync(
      path.resolve(process.cwd(), "services/security/APIKeyVault.ts"),
      "utf-8",
    );
    const setActiveBody = code.slice(
      code.indexOf("async setActive"),
      code.indexOf("async clearAll"),
    );
    expect(setActiveBody).toContain("db!.getAll(STORE_NAME)");
    expect(setActiveBody).not.toContain("await this.listKeys()");
  });

  // ── 源码 tripwire：listKeys 返回掩码副本 ──
  it("listKeys 返回掩码副本（源码 tripwire）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const code = fs.readFileSync(
      path.resolve(process.cwd(), "services/security/APIKeyVault.ts"),
      "utf-8",
    );
    const listKeysBody = code.slice(
      code.indexOf("async listKeys"),
      code.indexOf("async deleteKey"),
    );
    expect(listKeysBody).toContain("maskKey");
  });
});
