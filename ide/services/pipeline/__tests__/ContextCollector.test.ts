/**
 * @file: services/pipeline/__tests__/ContextCollector.test.ts
 * @description: ContextCollector 单元测试 — 上下文收集/文件树构建/Token 预算压缩
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @tags: [test],[ai],[pipeline],[context]
 */

import { describe, expect, it } from "vitest";
import {
  collectContext,
  compressContext,
  estimateTokens,
  type ContextCollectorInput,
} from "../ContextCollector";

function makeInput(overrides?: Partial<ContextCollectorInput>): ContextCollectorInput {
  return {
    fileContents: {
      "src/App.tsx": "export default function App() {}",
      "src/index.ts": "console.log(1)",
      "package.json": "{}",
    },
    activeFile: "src/index.ts",
    openTabs: [
      { path: "src/index.ts", modified: false },
      { path: "src/App.tsx", modified: true },
    ],
    gitBranch: "main",
    gitChanges: [{ path: "src/App.tsx", status: "M", staged: false }],
    ...overrides,
  };
}

// ── collectContext ──

describe("collectContext", () => {
  it("收集文件树/活跃文件/标签页/Git 摘要", () => {
    const ctx = collectContext(makeInput());

    expect(ctx.totalFiles).toBe(3);
    expect(ctx.allFilePaths).toEqual(["package.json", "src/App.tsx", "src/index.ts"]);
    expect(ctx.activeFile).toEqual({
      path: "src/index.ts",
      content: "console.log(1)",
    });
    expect(ctx.modifiedFiles).toEqual(["src/App.tsx"]);
    expect(ctx.openTabs).toEqual(["src/index.ts", "src/App.tsx"]);
    expect(ctx.gitSummary).toEqual({ branch: "main", changedFiles: 1, stagedFiles: 0 });
  });

  it("文件树按目录分组排序", () => {
    const ctx = collectContext(makeInput());
    expect(ctx.fileTree).toContain("📁 src/");
    expect(ctx.fileTree).toContain("⚛️ App.tsx");
    expect(ctx.fileTree).toContain("📋 package.json");
  });

  it("标签页内容排除活跃文件", () => {
    const ctx = collectContext(makeInput());
    expect(ctx.selectedFilesContent["src/index.ts"]).toBeUndefined();
    expect(ctx.selectedFilesContent["src/App.tsx"]).toBeDefined();
  });

  it("大标签页文件截断至 3000 chars", () => {
    const big = "x".repeat(5000);
    const ctx = collectContext(
      makeInput({
        fileContents: { "src/big.ts": big },
        activeFile: null,
        openTabs: [{ path: "src/big.ts", modified: false }],
      }),
    );
    const content = ctx.selectedFilesContent["src/big.ts"];
    expect(content).toContain("(truncated, 5000 chars total)");
    expect(content!.length).toBeLessThan(5100);
  });

  it("标签页清单上限 5 个", () => {
    const tabs = ["a", "b", "c", "d", "e", "f", "g"].map((n) => ({
      path: `src/${n}.ts`,
      modified: false,
    }));
    const ctx = collectContext(
      makeInput({
        fileContents: Object.fromEntries(tabs.map((t) => [t.path, "x"])),
        activeFile: null,
        openTabs: tabs,
      }),
    );
    expect(ctx.openTabs).toHaveLength(5);
  });

  it("活跃文件不存在于 fileContents 时为 null", () => {
    const ctx = collectContext(makeInput({ activeFile: "ghost.ts" }));
    expect(ctx.activeFile).toBeNull();
  });
});

// ── compressContext ──

describe("compressContext", () => {
  it("文件树始终包含；Git 状态始终包含", () => {
    const text = compressContext(collectContext(makeInput()), 6000);
    expect(text).toContain("项目文件结构");
    expect(text).toContain("Git 状态");
    expect(text).toContain("main");
  });

  it("活跃文件置于压缩输出中且大文件截断至 8000 chars", () => {
    const bigContent = "y".repeat(12000);
    const ctx = collectContext(
      makeInput({
        fileContents: { "src/big.ts": bigContent },
        activeFile: "src/big.ts",
        openTabs: [],
      }),
    );
    const text = compressContext(ctx, 60000);
    expect(text).toContain("src/big.ts");
    expect(text).toContain("(truncated, 12000 chars total)");
  });

  it("低 Token 预算下相关文件被裁剪", () => {
    const fileContents: Record<string, string> = {};
    for (let i = 0; i < 10; i++) fileContents[`src/rel${i}.ts`] = "z".repeat(2000);
    const ctx = collectContext(
      makeInput({
        fileContents,
        activeFile: null,
        openTabs: Object.keys(fileContents).map((p) => ({ path: p, modified: false })),
      }),
    );
    const text = compressContext(ctx, 800);
    // 预算 800 token，文件树+Git 占用后余量不足，大部分相关文件应被裁剪
    const included = (text.match(/## 相关文件/g) ?? []).length;
    expect(included).toBeLessThan(10);
  });
});

// ── estimateTokens ──

describe("estimateTokens", () => {
  it("中英混合 ~3.5 chars/token", () => {
    expect(estimateTokens("12345678901234567890123456789012345")).toBe(10);
  });
});
