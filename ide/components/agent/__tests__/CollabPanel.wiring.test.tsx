/**
 * @file: CollabPanel.wiring.test.tsx
 * @description: CollabPanel × CollabService 接线单测 — 状态/用户实时驱动 + 演示回退
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[collab],[panel],[wiring]
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CollabPanel from "../../../CollabPanel";
import type { CollabService, CollabEvent } from "../../../services/collab";

function makeFakeService(overrides: Partial<CollabService> = {}): CollabService {
  const listeners = new Set<(e: CollabEvent) => void>();
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getConnectionStatus: vi.fn().mockReturnValue("connected"),
    getUsers: vi.fn().mockReturnValue([
      { id: "u1", name: "云端甲", color: "#06b6d4", lastSeen: Date.now() },
      { id: "u2", name: "云端乙", color: "#a855f7", lastSeen: Date.now() },
    ]),
    subscribe: vi.fn((listener: (e: CollabEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    ...overrides,
  } as unknown as CollabService;
}

describe("CollabPanel × CollabService 接线", () => {
  it("注入 service 时 connect 被调用且用户列表来自服务", () => {
    const service = makeFakeService();
    render(<CollabPanel nodeId="n1" service={service} />);

    expect(service.connect).toHaveBeenCalled();
    expect(screen.getByText("云端甲")).toBeDefined();
    expect(screen.getByText("云端乙")).toBeDefined();
  });

  it("服务状态驱动连接指示（disconnected → 断开）", () => {
    const service = makeFakeService({
      getConnectionStatus: vi.fn().mockReturnValue("disconnected"),
    });
    render(<CollabPanel nodeId="n1" service={service} />);
    expect(screen.getByText("断开")).toBeDefined();
  });

  it("未注入 service 时保持演示模式（mock 用户）", () => {
    render(<CollabPanel nodeId="n1" />);
    // MOCK_USERS 中的张三仍在
    expect(screen.getByText("张三")).toBeDefined();
  });
});
