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
  setAutoRefresh: (auto: boolean) => void;
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
