/**
 * @file: stores/usePreviewStore.ts
 * @description: 预览状态管理 Store
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-07-25
 * @updated: 2026-07-25
 * @status: active
 * @tags: [store],[preview],[zustand]
 *
 * brief: 预览组件状态管理
 *
 * details:
 * - 管理预览刷新、URL、可见性
 * - 提供手动刷新和自动刷新能力
 *
 * dependencies: zustand (可选)
 * exports: usePreviewStore
 * notes: 存根实现，不依赖外部包
 */

// ================================================================
// 类型定义
// ================================================================

export interface PreviewState {
  /** 预览 URL */
  url: string;
  /** 预览是否可见 */
  visible: boolean;
  /** 刷新计数器（用于触发重渲染） */
  refreshCount: number;
  /** 是否自动刷新 */
  autoRefresh: boolean;
  /** 最后刷新时间 */
  lastRefreshTime: number;
  /** 编辑器↔预览滚动同步开关（MonacoWrapper 消费 · 收官清理补齐） */
  scrollSyncEnabled: boolean;
}

export interface PreviewActions {
  /** 触发刷新 */
  triggerRefresh: () => void;
  /** 设置 URL */
  setUrl: (url: string) => void;
  /** 切换可见性 */
  toggleVisible: () => void;
  /** 设置可见性 */
  setVisible: (visible: boolean) => void;
  /** 设置自动刷新 */
  setAutoRefresh: (autoRefresh: boolean) => void;
  /** 设置滚动同步 */
  setScrollSyncEnabled: (enabled: boolean) => void;
  /** 通知文件变更（预览模式控制器入口；无控制器时回退直接刷新） */
  notifyFileChange: () => void;
}

export type PreviewStore = PreviewState & PreviewActions;

// ================================================================
// 内存态实现
// ================================================================

let state: PreviewState = {
  url: "about:blank",
  visible: true,
  refreshCount: 0,
  autoRefresh: true,
  lastRefreshTime: Date.now(),
  scrollSyncEnabled: false,
};

const listeners: Set<() => void> = new Set();

function setState(partial: Partial<PreviewState>): void {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

function getState(): PreviewState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const actions: PreviewActions = {
  triggerRefresh() {
    setState({
      refreshCount: state.refreshCount + 1,
      lastRefreshTime: Date.now(),
    });
  },

  setUrl(url) {
    setState({ url });
  },

  toggleVisible() {
    setState({ visible: !state.visible });
  },

  setVisible(visible) {
    setState({ visible });
  },

  setAutoRefresh(auto) {
    setState({ autoRefresh: auto });
  },

  setScrollSyncEnabled(scrollSyncEnabled) {
    setState({ scrollSyncEnabled });
  },

  notifyFileChange() {
    // 本 Store 为轻量实现（无 modeController），文件变更直接触发刷新；
    // 归档版语义：有控制器时走控制器（节流/延迟策略），否则回退此处
    actions.triggerRefresh();
  },
};

// ================================================================
// 兼容 zustand API 的 Store 对象
// ================================================================

function usePreviewStore<T>(selector?: (state: PreviewStore) => T): T {
  if (selector) {
    return selector({ ...state, ...actions });
  }
  return { ...state, ...actions } as T;
}

usePreviewStore.getState = (): PreviewStore => ({ ...state, ...actions });
usePreviewStore.setState = setState;
usePreviewStore.subscribe = subscribe;

export { usePreviewStore };
export default usePreviewStore;
