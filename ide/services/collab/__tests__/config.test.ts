/**
 * @file: enhancements.test.ts
 * @description: 增强②③单测 — 沙箱异步工厂（真实注入/降级）+ 协作配置解析
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[terminal],[collab],[config],[factory]
 */

// 隔离 CollabService 真实依赖链（y-monaco 会拉入 monaco css 副作用）
vi.mock("../CollabService", () => ({
  createCollabService: vi.fn().mockReturnValue({
    getDoc: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    destroy: vi.fn(),
  }),
}));

import {
  resolveCollabConfigFromEnv,
  createCollabServiceFromConfig,
  COLLAB_DEFAULTS,
} from "../config";

describe("增强③：协作配置化", () => {
  it("env 覆盖 serverUrl/room/userName，未配置项保持默认", () => {
    const cfg = resolveCollabConfigFromEnv({
      VITE_COLLAB_SERVER_URL: "wss://collab.example.com",
      VITE_COLLAB_ROOM: "proj-42",
    });
    expect(cfg.serverUrl).toBe("wss://collab.example.com");
    expect(cfg.room).toBe("proj-42");
    expect(cfg.userName).toBe(COLLAB_DEFAULTS.userName);
    expect(cfg.userColor).toBe(COLLAB_DEFAULTS.userColor);
  });

  it("显式覆盖优先于 env 与默认值", async () => {
    const service = createCollabServiceFromConfig(
      { room: "override-room", userName: "甲" },
      { VITE_COLLAB_ROOM: "env-room" },
    );
    // 覆盖优先级：显式 > env > 默认
    const { createCollabService } = await import("../CollabService");
    expect(createCollabService).toHaveBeenCalledWith(
      expect.objectContaining({ room: "override-room", userName: "甲" }),
    );
    service.destroy();
  });

  it("缺省 env（空对象）返回完整默认配置", () => {
    const cfg = resolveCollabConfigFromEnv({});
    expect(cfg).toEqual(COLLAB_DEFAULTS);
  });
});
