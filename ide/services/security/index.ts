/**
 * @file: index.ts
 * @description: 安全套件统一出口 — 密钥库 / 消毒 / CSRF / 加密
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [security],[index],[barrel]
 *
 * brief: 第二批安全套件的「单一入口」
 *
 * usage:
 * ```
 * import { apiKeyVault, PROVIDERS, sanitizer, csrfProtection, EncryptionService } from "@/services/security";
 * ```
 */

export { apiKeyVault, PROVIDERS } from "./APIKeyVault";
export type { APIKeyConfig, ProviderId, ProviderInfo } from "./APIKeyVault";

export { sanitizer } from "./Sanitizer";

export { csrfProtection } from "./CsrfProtection";
export type { CsrfToken, CsrfConfig } from "./CsrfProtection";

export { EncryptionService } from "./EncryptionService";
export type { EncryptionStrength, EncryptionConfig, EncryptedData } from "./EncryptionService";
