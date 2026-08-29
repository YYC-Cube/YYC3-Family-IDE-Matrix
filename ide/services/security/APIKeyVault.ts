/**
 * @file: APIKeyVault.ts
 * @description: 安全的 API 密钥存储服务
 * @version: v1.1.0
 */

import { IDBPDatabase, openDB } from 'idb';

const DB_NAME = 'yyc3-api-vault';
const DB_VERSION = 1;
const STORE_NAME = 'api-keys';

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'zhipu'
  | 'moonshot'
  | 'qwen'
  | 'baichuan'
  | 'minimax'
  | 'custom';

export interface APIKeyConfig {
  id: string;
  provider: ProviderId;
  name: string;
  apiKey: string;
  baseUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
  usageCount: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  icon?: string;
  description: string;
  keyPrefix: string;
  keyPattern: RegExp;
  baseUrl: string;
  docsUrl: string;
  models: string[];
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5, DALL-E, Whisper',
    keyPrefix: 'sk-',
    keyPattern: /^sk-[a-zA-Z0-9]{48,}$/,
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5, Claude 3',
    keyPrefix: 'sk-ant-',
    keyPattern: /^sk-ant-api03-[a-zA-Z0-9-]{80,}$/,
    baseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek Chat, DeepSeek Coder',
    keyPrefix: 'sk-',
    keyPattern: /^sk-[a-zA-Z0-9]{32,}$/,
    baseUrl: 'https://api.deepseek.com/v1',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  zhipu: {
    id: 'zhipu',
    name: '智谱 AI',
    description: 'GLM-4, GLM-3-Turbo',
    keyPrefix: '',
    keyPattern: /^[a-zA-Z0-9]{32}\.[a-zA-Z0-9]{16}$/,
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    models: ['glm-4-plus', 'glm-4-0520', 'glm-3-turbo'],
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot AI',
    description: 'Kimi, Moonshot',
    keyPrefix: 'sk-',
    keyPattern: /^sk-[a-zA-Z0-9]{48,}$/,
    baseUrl: 'https://api.moonshot.cn/v1',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  qwen: {
    id: 'qwen',
    name: '通义千问',
    description: 'Qwen-Max, Qwen-Plus',
    keyPrefix: 'sk-',
    keyPattern: /^sk-[a-zA-Z0-9]{32,}$/,
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  },
  baichuan: {
    id: 'baichuan',
    name: '百川智能',
    description: 'Baichuan2-Turbo',
    keyPrefix: '',
    keyPattern: /^[a-zA-Z0-9]{32}$/,
    baseUrl: 'https://api.baichuan-ai.com/v1',
    docsUrl: 'https://platform.baichuan-ai.com/console/api-key',
    models: ['Baichuan2-Turbo', 'Baichuan2-53B'],
  },
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    description: 'abab6.5, abab5.5',
    keyPrefix: '',
    keyPattern: /^[a-zA-Z0-9]{32,}$/,
    baseUrl: 'https://api.minimax.chat/v1',
    docsUrl: 'https://www.minimaxi.com/user-center/basic-information/interface-key',
    models: ['abab6.5-chat', 'abab5.5-chat'],
  },
  custom: {
    id: 'custom',
    name: '自定义服务',
    description: '自定义 OpenAI 兼容 API',
    keyPrefix: '',
    keyPattern: /.+/,
    baseUrl: '',
    docsUrl: '',
    models: [],
  },
};

class APIKeyVault {
  private db: IDBPDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;

  async init(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('provider', 'provider');
          store.createIndex('isActive', 'isActive');
        }
      },
    });

    await this.initEncryptionKey();
  }

  // ── Phase 2 P2-2 密钥口令派生（审计 A1/M4）──
  //
  // 原实现：AES 密钥机器随机生成 → base64 裸存 sessionStorage（与密文同源同机）
  // 新实现：
  //   Mode A（用户口令）：PBKDF2(userPassphrase, salt, 310000) → 非导出 CryptoKey
  //     → 密钥不落盘、不可导出，只有输入正确口令才能解密
  //   Mode B（降级兼容）：无口令时走原路径（机器随机+sessionStorage）
  //     → 仅开发模式；生产 UI 应强制要求口令
  //
  // 非导出 CryptoKey（extractable: false）即使 XSS 也无法读取原始密钥字节。

  private vaultSalt: ArrayBuffer | null = null;

  /**
   * 使用用户口令解锁保险库（PBKDF2 派生 → 非导出 CryptoKey）
   * 必须在 init() 之前或之后调用；成功后 encryptionKey 不可导出。
   */
  async unlockWithPassphrase(passphrase: string): Promise<boolean> {
    if (!passphrase || passphrase.length < 4) {
      throw new Error('口令至少 4 个字符');
    }

    // 获取或生成盐（盐持久化在 localStorage，与密钥分离）
    const SALT_KEY = 'yyc3-vault-salt';
    const storedSalt = localStorage.getItem(SALT_KEY);
    if (storedSalt) {
      this.vaultSalt = Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0)).buffer as ArrayBuffer;
    } else {
      this.vaultSalt = crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer;
      const saltBytes = new Uint8Array(this.vaultSalt);
      const saltB64 = btoa(String.fromCharCode(...saltBytes));
      localStorage.setItem(SALT_KEY, saltB64);
    }

    // PBKDF2 派生（310,000 轮，OWASP 2024 推荐）
    const enc = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // 派生为非导出 AES-GCM 256 密钥
    this.encryptionKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: this.vaultSalt, iterations: 310_000, hash: 'SHA-256' },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false, // extractable: false → 即使 XSS 也无法导出密钥
      ['encrypt', 'decrypt']
    );

    // 清除旧模式密钥（如果有的话）
    sessionStorage.removeItem('yyc3-vault-key');
    localStorage.removeItem('yyc3-vault-salt');
    return true;
  }

  /** 检查保险库是否已用口令解锁（非导出密钥模式） */
  isUnlockedWithPassphrase(): boolean {
    return this.encryptionKey !== null && sessionStorage.getItem('yyc3-vault-key') === null;
  }

  /** 锁定保险库（清除内存密钥） */
  lock(): void {
    this.encryptionKey = null;
    this.vaultSalt = null;
  }

  private async initEncryptionKey(): Promise<void> {
    // Phase 2 P2-2：如果已有口令派生的密钥，跳过旧路径
    if (this.encryptionKey) return;

    // 旧路径（降级兼容，无口令模式）
    const storedKey = sessionStorage.getItem('yyc3-vault-key');

    if (storedKey) {
      const keyData = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
      this.encryptionKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    } else {
      this.encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // 旧模式需要导出（存储到 sessionStorage）
        ['encrypt', 'decrypt']
      );

      const exportedKey = await crypto.subtle.exportKey('raw', this.encryptionKey);
      const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
      sessionStorage.setItem('yyc3-vault-key', keyBase64);
    }
  }

  private async encrypt(text: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encodedText
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  private async decrypt(encryptedText: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }

  maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  }

  validateKey(provider: ProviderId, key: string): { valid: boolean; error?: string } {
    const providerInfo = PROVIDERS[provider];

    if (!key || key.trim().length === 0) {
      return { valid: false, error: 'API Key 不能为空' };
    }

    if (provider !== 'custom' && !providerInfo.keyPattern.test(key)) {
      return { valid: false, error: `API Key 格式不正确，应以 ${providerInfo.keyPrefix} 开头` };
    }

    return { valid: true };
  }

  async saveKey(config: Omit<APIKeyConfig, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<APIKeyConfig> {
    if (!this.db) await this.init();

    const validation = this.validateKey(config.provider, config.apiKey);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const existingKeys = await this.listKeys();
    const existing = existingKeys.find(k => k.provider === config.provider);

    const encryptedKey = await this.encrypt(config.apiKey);

    const now = new Date().toISOString();
    const newConfig: APIKeyConfig = {
      ...config,
      id: existing?.id || `${config.provider}-${Date.now()}`,
      apiKey: encryptedKey,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      usageCount: existing?.usageCount || 0,
    };

    await this.db!.put(STORE_NAME, newConfig);

    return { ...newConfig, apiKey: this.maskKey(config.apiKey) };
  }

  async getKey(id: string): Promise<string | null> {
    if (!this.db) await this.init();

    const config: any = await this.db!.get(STORE_NAME, id);
    if (!config) return null;

    try {
      const decrypted = await this.decrypt(config.apiKey);

      await this.db!.put(STORE_NAME, {
        ...config,
        lastUsed: new Date().toISOString(),
        usageCount: (config.usageCount || 0) + 1,
      });

      return decrypted;
    } catch {
      return null;
    }
  }

  async getActiveKey(provider: ProviderId): Promise<string | null> {
    if (!this.db) await this.init();

    const allKeys = await this.listKeys();
    const activeKey = allKeys.find(k => k.provider === provider && k.isActive);

    if (!activeKey) return null;

    return this.getKey(activeKey.id);
  }

  async listKeys(): Promise<APIKeyConfig[]> {
    if (!this.db) await this.init();

    const keys: any[] = await this.db!.getAll(STORE_NAME);
    return keys.map(k => ({ ...k, apiKey: this.maskKey(k.apiKey) }));
  }

  async deleteKey(id: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete(STORE_NAME, id);
  }

  async setActive(id: string): Promise<void> {
    if (!this.db) await this.init();

    // 安全修复（审计 H3）：必须从库取原始（加密）记录——listKeys 返回掩码副本，
    // 原实现将掩码文本 put 回库会把密钥永久覆盖损毁
    const rawKeys: APIKeyConfig[] = await this.db!.getAll(STORE_NAME);
    const targetKey = rawKeys.find(k => k.id === id);

    if (!targetKey) return;

    for (const key of rawKeys) {
      if (key.provider === targetKey.provider) {
        await this.db!.put(STORE_NAME, { ...key, isActive: key.id === id });
      }
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear(STORE_NAME);
    sessionStorage.removeItem('yyc3-vault-key');
    localStorage.removeItem('yyc3-vault-salt');
    this.encryptionKey = null;
  }

  async exportConfig(): Promise<string> {
    const keys = await this.listKeys();
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      keys: keys.map(k => ({
        provider: k.provider,
        name: k.name,
        baseUrl: k.baseUrl,
        isActive: k.isActive,
      })),
    };
    return JSON.stringify(exportData, null, 2);
  }
}

export const apiKeyVault = new APIKeyVault();
