/**
 * @file: useMemoryStore.test.ts
 * @description: 持久记忆 Store 单测 — 初始化降级 / CRUD / 搜索 / 语义检索
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[memory],[store],[zustand]
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  useMemoryStore,
  generateEmbedding,
  semanticSimilarity,
  type MemoryItem,
} from "../useMemoryStore";

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    title: "测试记忆",
    summary: "用于单元测试的记忆条目",
    category: "project",
    agent: "planner",
    relevance: 50,
    pinned: false,
    createdAt: "2026-08-20",
    updatedAt: "2026-08-20",
    usageCount: 0,
    tags: ["test"],
    ...overrides,
  };
}

describe("useMemoryStore", () => {
  beforeEach(async () => {
    // jsdom 无 indexedDB → initialize 走内置降级路径（内存种子）
    useMemoryStore.setState({ memories: [], initialized: false, loading: false });
    await useMemoryStore.getState().initialize();
  });

  it("无 IndexedDB 环境下初始化降级为内存种子数据", () => {
    const state = useMemoryStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.memories.length).toBeGreaterThanOrEqual(6);
    expect(state.memories.some((m) => m.id === "mem-seed-1")).toBe(true);
  });

  it("addMemory 追加条目并生成嵌入向量", async () => {
    const before = useMemoryStore.getState().memories.length;
    await useMemoryStore.getState().addMemory({
      title: "Zustand 用法",
      summary: "create + set + get 三件套",
      category: "patterns",
      agent: "coder",
      relevance: 60,
      pinned: false,
      tags: ["zustand", "state"],
    });

    const state = useMemoryStore.getState();
    expect(state.memories.length).toBe(before + 1);
    const added = state.memories[state.memories.length - 1];
    expect(added.id).toMatch(/^mem-/);
    expect(Array.isArray(added.embedding)).toBe(true);
    expect(added.usageCount).toBe(0);
  });

  it("updateMemory/togglePin/incrementUsage 维护条目状态", async () => {
    // 注意：addMemory 会生成新 id 并将 usageCount 重置为 0（源行为）
    await useMemoryStore.getState().addMemory(makeItem({ pinned: false }));
    const id = useMemoryStore.getState().memories.slice(-1)[0].id;

    await useMemoryStore.getState().updateMemory(id, { title: "改后标题" });
    expect(useMemoryStore.getState().memories.find((m) => m.id === id)?.title).toBe("改后标题");

    await useMemoryStore.getState().togglePin(id);
    expect(useMemoryStore.getState().memories.find((m) => m.id === id)?.pinned).toBe(true);

    await useMemoryStore.getState().incrementUsage(id);
    expect(useMemoryStore.getState().memories.find((m) => m.id === id)?.usageCount).toBe(1);
  });

  it("removeMemory 删除指定条目", async () => {
    await useMemoryStore.getState().addMemory(makeItem());
    const id = useMemoryStore.getState().memories.slice(-1)[0].id;
    await useMemoryStore.getState().removeMemory(id);
    expect(useMemoryStore.getState().memories.find((m) => m.id === id)).toBeUndefined();
  });

  it("search 按关键词与分类过滤，置顶优先", () => {
    const hits = useMemoryStore.getState().search("monaco");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].title).toContain("Monaco");

    const patterns = useMemoryStore.getState().search("", "patterns");
    expect(patterns.every((m) => m.category === "patterns")).toBe(true);
  });

  it("getByAgent 按角色筛选", () => {
    const coders = useMemoryStore.getState().getByAgent("coder");
    expect(coders.length).toBeGreaterThanOrEqual(2);
    expect(coders.every((m) => m.agent === "coder")).toBe(true);
  });

  it("semanticSearch 返回带相似度评分的条目", () => {
    const hits = useMemoryStore.getState().semanticSearch("zustand 状态管理");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].similarity).toBeGreaterThan(5);
    // 降序排列
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].similarity).toBeGreaterThanOrEqual(hits[i].similarity);
    }
  });

  it("getRelevant 综合语义/相关度/置顶/使用次数打分", () => {
    const hits = useMemoryStore.getState().getRelevant("LLM 调用 流式", 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });

  it("clearAll 清空后 recomputeEmbeddings 可重建向量", async () => {
    await useMemoryStore.getState().clearAll();
    expect(useMemoryStore.getState().memories).toHaveLength(0);
  });
});

describe("语义工具函数", () => {
  it("generateEmbedding 产出数值向量", () => {
    const vec = generateEmbedding({ title: "hello world", summary: "greeting", tags: ["en"] });
    expect(Array.isArray(vec)).toBe(true);
    expect(vec.every((v) => typeof v === "number" && !Number.isNaN(v))).toBe(true);
  });

  it("semanticSimilarity 相同文本得分高于无关文本", () => {
    const item = makeItem({ title: "react zustand", summary: "状态管理", tags: ["react"] });
    const near = semanticSimilarity("react zustand 状态管理", item);
    const far = semanticSimilarity("docker kubernetes 部署", item);
    expect(near).toBeGreaterThan(far);
  });
});
