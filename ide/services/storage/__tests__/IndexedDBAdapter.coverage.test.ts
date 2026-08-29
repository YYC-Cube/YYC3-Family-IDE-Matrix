/**
 * @file: IndexedDBAdapter.coverage.test.ts
 * @description: IndexedDBAdapter 核心方法测试 — Phase 1 P1-7（jsdom 无 idb，签名+纯函数面）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-28
 * @updated: 2026-08-28
 * @status: active
 * @tags: [test],[storage],[indexeddb]
 */

import { describe, it, expect } from "vitest";
import * as adapter from "../IndexedDBAdapter";

describe("IndexedDBAdapter · 导出面完整性", () => {
  it("文件操作 API 全量导出", () => {
    const fileApis = [
      "saveFile", "saveFiles", "loadFile", "loadFiles",
      "loadAllFiles", "deleteFile", "deleteAllFiles",
    ];
    fileApis.forEach((name) => {
      expect(typeof (adapter as unknown as Record<string, unknown>)[name]).toBe("function");
    });
  });

  it("项目操作 API 全量导出", () => {
    const projectApis = ["saveProject", "loadProject", "listProjects", "deleteProject"];
    projectApis.forEach((name) => {
      expect(typeof (adapter as unknown as Record<string, unknown>)[name]).toBe("function");
    });
  });

  it("快照操作 API 全量导出", () => {
    const snapshotApis = ["createSnapshot", "loadSnapshot", "listSnapshots", "deleteSnapshot"];
    snapshotApis.forEach((name) => {
      expect(typeof (adapter as unknown as Record<string, unknown>)[name]).toBe("function");
    });
  });

  it("性能与缓存 API 全量导出（optimized 版特性）", () => {
    const perfApis = [
      "getPerformanceMetrics", "getCacheHitRate", "resetPerformanceMetrics",
      "clearCache", "getCacheStats",
    ];
    perfApis.forEach((name) => {
      expect(typeof (adapter as unknown as Record<string, unknown>)[name]).toBe("function");
    });
  });

  it("工具函数 API 全量导出", () => {
    const utilApis = [
      "getDB", "getStorageEstimate",
      "debouncedSaveFiles", "immediateSaveFiles",
      "listFiles", "clearAllData",
    ];
    utilApis.forEach((name) => {
      expect(typeof (adapter as unknown as Record<string, unknown>)[name]).toBe("function");
    });
  });

  it("类型接口（StoredFile/StoredProject/StoredSnapshot/PerformanceMetrics）在 d.ts 层可用", () => {
    // 运行时验证导出非空即可；类型层面由 tsc 保证
    expect(adapter).toBeTruthy();
    expect(Object.keys(adapter).length).toBeGreaterThanOrEqual(20);
  });
});

describe("IndexedDBAdapter · getDB 双版本合并回归", () => {
  it("getDB 为具名导出（非 optimized 版丢失项——审计合并修复）", () => {
    // BackupService / VersioningService 依赖 getDB 具名导出
    expect(adapter.getDB).toBeDefined();
    expect(typeof adapter.getDB).toBe("function");
  });
});
