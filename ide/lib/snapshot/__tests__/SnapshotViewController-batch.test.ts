/**
 * @file: lib/snapshot/__tests__/SnapshotViewController-batch.test.ts
 * @description: SnapshotViewController 批量回调机制单元测试
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [test],[snapshot],[controller],[batch-callback]
 *
 * brief: 测试视图控制器的批量回调机制
 *
 * details:
 * - 测试 onViewsChange 批量回调接口存在
 * - 测试 SnapshotViewControllerConfig 类型包含新字段
 * - 验证 API 兼容性
 *
 * test-target: lib/snapshot/SnapshotViewController.ts
 * notes: 使用 Vitest
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SnapshotViewController } from "../SnapshotViewController";
import type { SnapshotViewControllerConfig, ViewState } from "../SnapshotViewController";

describe("SnapshotViewController - 批量回调配置", () => {
  it("应支持 onViewsChange 批量回调配置", () => {
    const config: SnapshotViewControllerConfig = {
      onViewsChange: (changes) => {
        expect(Array.isArray(changes)).toBe(true);
      },
    };
    const ctrl = new SnapshotViewController(config);
    expect(ctrl).toBeDefined();
  });

  it("应同时支持 onViewChange 和 onViewsChange 两种回调", () => {
    const config: SnapshotViewControllerConfig = {
      onViewChange: (viewId, state) => {},
      onViewsChange: (changes) => {},
    };
    const ctrl = new SnapshotViewController(config);
    expect(ctrl).toBeDefined();
  });
});

describe("SnapshotViewController - 基础 API", () => {
  let controller: SnapshotViewController;

  beforeEach(() => {
    controller = new SnapshotViewController();
  });

  it("应能正确初始化", () => {
    expect(controller).toBeDefined();
  });

  it("应能添加视图", () => {
    controller.addView("view1", "snap-1");
    expect(controller.getViewCount()).toBe(1);
  });

  it("应能获取视图状态", () => {
    controller.addView("view1", "snap-1");
    const state = controller.getViewState("view1");
    expect(state).toBeDefined();
    expect(state?.viewId).toBe("view1");
  });

  it("应能删除视图", () => {
    controller.addView("view1", "snap-1");
    const result = controller.removeView("view1");
    expect(result).toBe(true);
    expect(controller.getViewCount()).toBe(0);
  });

  it("应能更新视图位置", () => {
    controller.addView("view1", "snap-1");
    const result = controller.updateViewPosition("view1", { scrollX: 100 });
    expect(result).toBe(true);

    const state = controller.getViewState("view1");
    expect(state?.position.scrollX).toBe(100);
  });

  it("应能获取所有视图", () => {
    controller.addView("view1", "snap-1");
    controller.addView("view2", "snap-1");
    const allViews = controller.getAllViews();
    expect(allViews.length).toBe(2);
  });

  it("应能设置滚动同步开关", () => {
    controller.setSyncScroll(false);
    controller.setSyncScroll(true);
    // 不报错即为通过
    expect(true).toBe(true);
  });

  it("应能设置缩放同步开关", () => {
    controller.setSyncZoom(false);
    controller.setSyncZoom(true);
    expect(true).toBe(true);
  });

  it("应能正确销毁", () => {
    controller.addView("view1", "snap-1");
    controller.addView("view2", "snap-1");
    controller.destroy();
    expect(controller.getViewCount()).toBe(0);
  });

  describe("comparisonConfig 访问", () => {
    it("应能使用默认的 comparisonConfig", () => {
      const ctrl = new SnapshotViewController();
      expect(ctrl).toBeDefined();
    });

    it("应能自定义 comparisonConfig", () => {
      const ctrl = new SnapshotViewController({
        comparisonConfig: {
          sideBySide: true,
          syncScroll: false,
          syncZoom: true,
          highlightDiffs: true,
          diffOpacity: 0.6,
        },
      });
      expect(ctrl).toBeDefined();
    });
  });

  describe("zoomConfig 访问", () => {
    it("应能自定义 zoomConfig", () => {
      const ctrl = new SnapshotViewController({
        zoomConfig: {
          minZoom: 25,
          maxZoom: 200,
          zoomStep: 25,
        },
      });
      expect(ctrl).toBeDefined();
    });
  });
});
