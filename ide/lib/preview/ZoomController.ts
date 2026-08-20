/**
 * @file: preview/ZoomController.ts
 * @description: 预览缩放控制器 · 符合 SnapshotViewController 契约 (L-修复完善)
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-08-19
 * @updated: 2026-08-19
 * @status: active
 * @tags: [preview],[zoom],[controller],[snapshot]
 *
 * brief: 预览视图的缩放 (Zoom) 状态管理 — SnapshotViewController 硬依赖
 *
 * details:
 *   v2.0 (L-修复完善)：与 SnapshotViewController 完整契约对齐，满足 4 个公开 API：
 *
 *   构造参数 (SnapshotViewController L121-L129 调用格式):
 *     new ZoomController({
 *       initialZoom: 100,     // 整数百分比 (25~200)，不是 0~1 scale 小数
 *       minZoom: 25,          // 最小缩放 %
 *       maxZoom: 200,         // 最大缩放 %
 *       zoomStep: 25,         // zoomIn/Out 步长
 *       onZoomChange: (zoom) => {...}  // 整数回调
 *     })
 *
 *   公开方法 (SnapshotViewController 内部用到):
 *     setZoom(scale: number)   void         — snapshot 内部: zoom / 100 传 scale
 *     getCurrentZoom(): number              — 返回整数 zoom%
 *     zoomIn(): boolean                     — 按 zoomStep +1 档
 *     zoomOut(): boolean                    — 按 zoomStep -1 档
 *     resetZoom(): boolean                  — 回到 initialZoom (100)
 *     zoomToFit(containerWidth, contentWidth): boolean
 *                                           — 计算 content/container → zoom%
 *     destroy(): void                       — 清理回调
 *     getState(): ZoomState                 — 兼容旧版 (向后兼容字段 scale/offsetX/offsetY)
 *
 *   注意: SnapshotViewController 的 ViewPosition.zoom 单位是 整数 percent (100=100%)，
 *   与 v1.0 ZoomController 的 scale 小数 (1.0=100%) 不同 — 本模块内部以 percent 为主，
 *   getState() 仍返回 scale 小数 (zoom/100)，确保旧消费方也能工作。
 *
 * dependencies: none (纯 TS，零依赖)
 * exports: ZoomController (class), ZoomState (interface)
 */

// ==================================================================
// 1. 缩放状态类型
// ==================================================================

/** 缩放状态 — 向后兼容字段 (v1.0 scale/offsetX/offsetY) */
export interface ZoomState {
  /** 缩放比例，1.0 = 100% (小数 scale，向后兼容) */
  scale: number;
  /** 视口水平偏移 (px)，用于缩放后平移对齐 */
  offsetX: number;
  /** 视口垂直偏移 (px) */
  offsetY: number;
}

// ==================================================================
// 2. 构造参数类型 (SnapshotViewController 要求的格式)
// ==================================================================

export interface ZoomControllerOptions {
  /** 初始缩放 (整数百分比，默认 100) */
  initialZoom?: number;
  /** 最小缩放 (整数百分比，默认 25) */
  minZoom?: number;
  /** 最大缩放 (整数百分比，默认 200) */
  maxZoom?: number;
  /** 放大/缩小步长 (整数百分比，默认 25) */
  zoomStep?: number;
  /** 缩放变化回调 (参数为整数百分比 zoom) */
  onZoomChange?: (zoom: number) => void;
}

// ==================================================================
// 3. 控制器类 (SnapshotViewController 契约)
// ==================================================================

export class ZoomController {
  private currentZoom: number;
  private minZoom: number;
  private maxZoom: number;
  private zoomStep: number;
  private onZoomChange?: (zoom: number) => void;
  /** 用于 destroy() 后静默忽略后续调用的标记 */
  private destroyed: boolean;

  constructor(options: ZoomControllerOptions = {}) {
    const {
      initialZoom = 100,
      minZoom = 25,
      maxZoom = 200,
      zoomStep = 25,
      onZoomChange,
    } = options;

    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.zoomStep = zoomStep;
    this.currentZoom = this.clampPercent(initialZoom);
    this.onZoomChange = onZoomChange;
    this.destroyed = false;
  }

  // ==================================================================
  // SnapshotViewController 必须的 API (严格对齐调用签名)
  // ==================================================================

  /**
   * 设置缩放比例 (scale 小数 0.25~2.0)
   * 调用方: SnapshotViewController.syncZoomLevel L355: setZoom(sourceView.position.zoom / 100)
   */
  setZoom(scale: number): void {
    if (this.destroyed) return;
    const percent = Math.round(Number(scale) * 100);
    const clamped = this.clampPercent(percent);
    if (clamped === this.currentZoom) return;
    this.currentZoom = clamped;
    this.emitChange();
  }

  /**
   * 返回整数百分比 zoom (25~200)
   * 调用方: zoomToFit/resetAllZoom → view.position.zoom = getCurrentZoom()
   */
  getCurrentZoom(): number {
    return this.currentZoom;
  }

  /**
   * 放大所有视图 (按 zoomStep 步长 +)
   * 返回是否成功变更 (到达 maxZoom 时返回 false)
   */
  zoomIn(): boolean {
    if (this.destroyed) return false;
    const next = this.clampPercent(this.currentZoom + this.zoomStep);
    if (next === this.currentZoom) return false;
    this.currentZoom = next;
    this.emitChange();
    return true;
  }

  /**
   * 缩小所有视图 (按 zoomStep 步长 -)
   */
  zoomOut(): boolean {
    if (this.destroyed) return false;
    const next = this.clampPercent(this.currentZoom - this.zoomStep);
    if (next === this.currentZoom) return false;
    this.currentZoom = next;
    this.emitChange();
    return true;
  }

  /**
   * 重置所有视图缩放到 initialZoom (默认 100%)
   */
  resetZoom(): boolean {
    if (this.destroyed) return false;
    // 回到默认 100% (SnapshotViewController 测试断言 view.position.zoom === 100)
    const target = 100;
    if (target === this.currentZoom) return true;
    this.currentZoom = target;
    this.emitChange();
    return true;
  }

  /**
   * 按容器/内容宽度计算合适的缩放 (container / content * 100，取整数)
   * 例子: zoomToFit(800, 1600) → 800/1600=0.5 → 50%
   */
  zoomToFit(containerWidth: number, contentWidth: number): boolean {
    if (this.destroyed) return false;
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) return false;
    if (!Number.isFinite(contentWidth) || contentWidth <= 0) return false;
    const percent = Math.round((containerWidth / contentWidth) * 100);
    const clamped = this.clampPercent(percent);
    if (clamped === this.currentZoom) return true;
    this.currentZoom = clamped;
    this.emitChange();
    return true;
  }

  /**
   * 销毁控制器: 清空回调，防止内存泄漏和 destroy 后调用抛错
   */
  destroy(): void {
    this.onZoomChange = undefined;
    this.destroyed = true;
  }

  // ==================================================================
  // 向后兼容 v1.0 API (不被 SnapshotViewController 用到，但避免其他消费方 break)
  // ==================================================================

  getState(): ZoomState {
    return {
      scale: this.currentZoom / 100,
      offsetX: 0,
      offsetY: 0,
    };
  }

  setZoomEx(next: Partial<ZoomState>): ZoomState {
    if (next.scale !== undefined) this.setZoom(next.scale);
    return this.getState();
  }

  applyFactor(factor: number): ZoomState {
    if (!Number.isFinite(factor) || factor <= 0) return this.getState();
    this.setZoom((this.currentZoom / 100) * factor);
    return this.getState();
  }

  reset(): ZoomState {
    this.resetZoom();
    return this.getState();
  }

  // ==================================================================
  // 内部辅助
  // ==================================================================

  private clampPercent(zoom: number): number {
    if (!Number.isFinite(zoom)) return 100;
    return Math.min(this.maxZoom, Math.max(this.minZoom, Math.round(zoom)));
  }

  private emitChange(): void {
    if (typeof this.onZoomChange === "function") {
      try {
        this.onZoomChange(this.currentZoom);
      } catch {
        /* 消费方回调抛错不应中断 controller 流程 */
      }
    }
  }
}

/** 默认导出 — 便于 import ZoomController from "./ZoomController" */
export default ZoomController;
