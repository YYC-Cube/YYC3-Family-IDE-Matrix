/**
 * @file: layout-ops.ts
 * @description: 布局树纯函数操作 — 查找/分裂/删除/替换/交换/邻位插入（面板壳三期）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [panel-host],[layout],[tree],[pure]
 *
 * brief: 布局编辑的决策核心 —— 全部为纯函数，便于单测与未来持久化/撤销
 */

import type { LayoutNode, PanelId, SplitDirection } from "./PanelManagerContext";

let nodeSeq = 0;
export function genNodeId(prefix = "node"): string {
  return `${prefix}_${Date.now().toString(36)}_${++nodeSeq}`;
}

// ── 查找 ──

export function findNode(root: LayoutNode, id: string): LayoutNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return null;
}

export function findParent(
  root: LayoutNode,
  id: string,
): LayoutNode | null {
  for (const child of root.children ?? []) {
    if (child.id === id) return root;
    const hit = findParent(child, id);
    if (hit) return hit;
  }
  return null;
}

// ── 变换（均返回新树，不修改入参）──

/**
 * 分裂：把叶子节点变为 split，原叶子与新面板各占 50%
 */
export function splitNode(
  root: LayoutNode,
  nodeId: string,
  direction: SplitDirection,
  newPanelId: PanelId,
): LayoutNode {
  return mapTree(root, (node) => {
    if (node.id !== nodeId || node.type !== "leaf") return node;
    const original: LayoutNode = { ...node, size: 50 };
    const added: LayoutNode = {
      id: genNodeId("split"),
      type: "leaf",
      panelId: newPanelId,
      size: 50,
    };
    return {
      id: genNodeId("split"),
      type: "split",
      direction,
      children: [original, added],
    };
  });
}

/**
 * 删除节点并修剪空的 split 父级；兄弟节点继承全部尺寸
 */
export function removeNode(root: LayoutNode, nodeId: string): LayoutNode {
  function prune(node: LayoutNode): LayoutNode | null {
    if (node.id === nodeId) return null;
    if (node.type === "split") {
      const children = (node.children ?? [])
        .map(prune)
        .filter((c): c is LayoutNode => c !== null);
      if (children.length === 0) return null;
      // 单子节点：上提替换父级（继承父 id 保引用稳定）
      if (children.length === 1) return { ...children[0], id: node.id };
      return { ...node, children };
    }
    return node;
  }
  return prune(root) ?? root;
}

/**
 * 邻位插入（merge 语义）：在目标叶子旁放入面板。
 * 若目标父级 split 方向与期望一致 → 追加；否则包裹一层新 split。
 */
export function insertPanelBeside(
  root: LayoutNode,
  targetNodeId: string,
  panelId: PanelId,
  position: "left" | "right" | "top" | "bottom",
): LayoutNode {
  const direction: SplitDirection =
    position === "left" || position === "right" ? "horizontal" : "vertical";
  const before = position === "left" || position === "top";

  const added: LayoutNode = {
    id: genNodeId("merged"),
    type: "leaf",
    panelId,
    size: 50,
  };

  return mapTree(root, (node) => {
    if (node.id !== targetNodeId || node.type !== "leaf") return node;
    const target: LayoutNode = { ...node, size: 50 };
    return {
      id: genNodeId("merged-split"),
      type: "split",
      direction,
      children: before ? [added, target] : [target, added],
    };
  });
}

/** 替换叶子的面板 id */
export function replacePanel(
  root: LayoutNode,
  nodeId: string,
  panelId: PanelId,
): LayoutNode {
  return mapTree(root, (node) =>
    node.id === nodeId && node.type === "leaf" ? { ...node, panelId } : node,
  );
}

/** 交换两个叶子的面板 id（DnD 落点的核心语义） */
export function swapPanels(
  root: LayoutNode,
  nodeIdA: string,
  nodeIdB: string,
): LayoutNode {
  const a = findNode(root, nodeIdA);
  const b = findNode(root, nodeIdB);
  if (!a || !b || a.type !== "leaf" || b.type !== "leaf" || a.id === b.id) {
    return root;
  }
  return mapTree(root, (node) => {
    if (node.id === nodeIdA) return { ...node, panelId: b.panelId };
    if (node.id === nodeIdB) return { ...node, panelId: a.panelId };
    return node;
  });
}

/** 同层相邻兄弟间移动尺寸（分隔条拖拽）：把 delta 百分比从 index 移给 index+1 */
export function resizeSibling(
  root: LayoutNode,
  parentId: string,
  index: number,
  deltaPercent: number,
): LayoutNode {
  return mapTree(root, (node) => {
    if (node.id !== parentId || node.type !== "split") return node;
    const children = [...(node.children ?? [])];
    const a = children[index];
    const b = children[index + 1];
    if (!a || !b) return node;
    const sizeA = clamp((a.size ?? 100 / children.length) + deltaPercent, 10, 90);
    children[index] = { ...a, size: sizeA };
    children[index + 1] = { ...b, size: clamp(100 - sizeA, 10, 90) };
    return { ...node, children };
  });
}

// ── 内部工具 ──

/**
 * 自底向上的树映射：先处理子树、再对当前节点应用变换。
 * 关键性质：fn 生成的新子树（如 splitNode 的包裹层）不会被再次访问，
 * 避免自顶向下实现中"新叶子命中同一条件被二次包裹"的错误。
 */
function mapTree(node: LayoutNode, fn: (n: LayoutNode) => LayoutNode): LayoutNode {
  const withChildren =
    node.children && node.children.length > 0
      ? { ...node, children: node.children.map((c) => mapTree(c, fn)) }
      : node;
  return fn(withChildren);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
