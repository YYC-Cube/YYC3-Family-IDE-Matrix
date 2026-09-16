/**
 * @file: services/pipeline/__tests__/CodeApplicator.test.ts
 * @description: CodeApplicator 单元测试 — 代码块解析/三级路径解析/Zod 路径校验/落盘/diff
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @tags: [test],[ai],[pipeline]
 */

import { describe, expect, it } from "vitest";
import {
  applyCodeToFiles,
  generatePlanDiff,
  generateSimpleDiff,
  isSafeFilepath,
  parseCodeBlocks,
  type FileStoreAdapter,
} from "../CodeApplicator";

// ── isSafeFilepath ──

describe("isSafeFilepath", () => {
  it("接受合法相对路径", () => {
    expect(isSafeFilepath("src/components/Button.tsx")).toBe(true);
    expect(isSafeFilepath("README.md")).toBe(true);
    expect(isSafeFilepath("docs/(draft)/note.md")).toBe(true);
  });

  it("拒绝越界路径 (..)", () => {
    expect(isSafeFilepath("../evil.ts")).toBe(false);
    expect(isSafeFilepath("src/../../etc/passwd")).toBe(false);
  });

  it("拒绝反斜杠路径", () => {
    expect(isSafeFilepath("src\\evil.tsx")).toBe(false);
  });

  it("拒绝空路径与非法字符", () => {
    expect(isSafeFilepath("")).toBe(false);
    expect(isSafeFilepath("src/<script>.ts")).toBe(false);
    expect(isSafeFilepath("a;rm -rf.ts")).toBe(false);
  });
});

// ── parseCodeBlocks ──

describe("parseCodeBlocks", () => {
  it("一级路径解析：首行 filepath 注释", () => {
    const reply = [
      "这是修改：",
      "```tsx",
      "// filepath: src/components/Button.tsx",
      "export default function Button() {",
      "  return null;",
      "}",
      "```",
    ].join("\n");

    const plan = parseCodeBlocks(reply, {});
    expect(plan.fileCount).toBe(1);
    expect(plan.blocks[0].filepath).toBe("src/components/Button.tsx");
    expect(plan.blocks[0].language).toBe("tsx");
    expect(plan.blocks[0].isNew).toBe(true);
    // filepath 注释行应被清除，不留入落盘内容
    expect(plan.blocks[0].content).not.toContain("filepath:");
    expect(plan.blocks[0].content).toContain("export default function Button()");
  });

  it("二级路径解析：上文语境中的文件引用", () => {
    const reply = [
      "下面修改 `src/App.tsx`：",
      "```tsx",
      "export default function App() {",
      "  return <div />;",
      "}",
      "```",
    ].join("\n");

    const plan = parseCodeBlocks(reply, { "src/App.tsx": "old" });
    expect(plan.blocks[0].filepath).toBe("src/App.tsx");
    expect(plan.blocks[0].isNew).toBe(false);
  });

  it("三级路径解析：export 函数名推断新组件路径", () => {
    const reply = [
      "```tsx",
      "export default function Card() {",
      "  return null;",
      "}",
      "```",
    ].join("\n");

    const plan = parseCodeBlocks(reply, {});
    expect(plan.blocks[0].filepath).toBe("src/components/Card.tsx");
  });

  it("三级路径解析：命中已存在的同名组件文件", () => {
    const reply = [
      "```ts",
      "export function utils() {",
      "  return 1;",
      "}",
      "```",
    ].join("\n");

    const plan = parseCodeBlocks(reply, { "src/lib/utils.ts": "old" });
    expect(plan.blocks[0].filepath).toBe("src/lib/utils.ts");
  });

  it("跳过 shell/控制台等非落盘语言", () => {
    const reply = [
      "运行命令：",
      "```bash",
      "pnpm install",
      "```",
      "```console",
      "some output",
      "```",
    ].join("\n");

    expect(parseCodeBlocks(reply, {}).fileCount).toBe(0);
  });

  it("跳过无路径且无法推断的代码块", () => {
    const reply = ["```tsx", "<div>片段</div>", "```"].join("\n");
    expect(parseCodeBlocks(reply, {}).fileCount).toBe(0);
  });

  it("拦截越界路径的代码块", () => {
    const reply = [
      "```ts",
      "// filepath: ../outside.ts",
      "export const x = 1;",
      "```",
    ].join("\n");
    expect(parseCodeBlocks(reply, {}).fileCount).toBe(0);
  });

  it("同路径多块取最后（迭代修正语义）", () => {
    const reply = [
      "```ts",
      "// filepath: src/a.ts",
      "export const v1 = 1;",
      "```",
      "修正：",
      "```ts",
      "// filepath: src/a.ts",
      "export const v2 = 2;",
      "```",
    ].join("\n");

    const plan = parseCodeBlocks(reply, {});
    expect(plan.fileCount).toBe(1);
    expect(plan.blocks[0].content).toContain("v2");
  });

  it("summary 区分新建与修改", () => {
    const reply = [
      "新建：",
      "```ts",
      "// filepath: src/new.ts",
      "export const a = 1;",
      "```",
      "修改：",
      "```ts",
      "// filepath: src/old.ts",
      "export const b = 2;",
      "```",
    ].join("\n");

    const plan = parseCodeBlocks(reply, { "src/old.ts": "x" });
    expect(plan.newFileCount).toBe(1);
    expect(plan.modifiedFileCount).toBe(1);
    expect(plan.summary).toContain("新建 1 个文件");
    expect(plan.summary).toContain("修改 1 个文件");
  });

  it("空回复 → 无代码变更", () => {
    const plan = parseCodeBlocks("纯文本回复，无代码。", {});
    expect(plan.blocks).toHaveLength(0);
    expect(plan.summary).toBe("无代码变更");
  });
});

// ── applyCodeToFiles ──

describe("applyCodeToFiles", () => {
  function makeAdapter() {
    const created: [string, string][] = [];
    const updated: [string, string][] = [];
    const adapter: FileStoreAdapter = {
      createFile: (p, c) => created.push([p, c]),
      updateFile: (p, c) => updated.push([p, c]),
    };
    return { adapter, created, updated };
  }

  it("新文件走 createFile，已有文件走 updateFile", () => {
    const plan = parseCodeBlocks(
      [
        "```ts",
        "// filepath: src/new.ts",
        "export const a = 1;",
        "```",
        "```ts",
        "// filepath: src/old.ts",
        "export const b = 2;",
        "```",
      ].join("\n"),
      { "src/old.ts": "x" },
    );

    const { adapter, created, updated } = makeAdapter();
    const result = applyCodeToFiles(plan, adapter);

    expect(result.success).toBe(true);
    expect(created).toEqual([["src/new.ts", "export const a = 1;"]]);
    expect(updated).toEqual([["src/old.ts", "export const b = 2;"]]);
    expect(result.appliedFiles).toHaveLength(2);
  });

  it("单文件失败不阻断其余文件", () => {
    const plan = parseCodeBlocks(
      [
        "```ts",
        "// filepath: src/bad.ts",
        "export const a = 1;",
        "```",
        "```ts",
        "// filepath: src/good.ts",
        "export const b = 2;",
        "```",
      ].join("\n"),
      {},
    );

    const applied: string[] = [];
    const result = applyCodeToFiles(plan, {
      createFile: (p, c) => {
        if (p === "src/bad.ts") throw new Error("disk full");
        applied.push(p);
      },
      updateFile: (p, c) => applied.push(p),
    });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("disk full");
    expect(result.appliedFiles).toEqual(["src/good.ts"]);
  });
});

// ── diff ──

describe("generateSimpleDiff", () => {
  it("新文件全行 added", () => {
    const diff = generateSimpleDiff(undefined, "line1\nline2");
    expect(diff).toEqual([
      { type: "added", content: "line1", lineNumber: 1 },
      { type: "added", content: "line2", lineNumber: 2 },
    ]);
  });

  it("修改文件逐行比对 unchanged/removed/added", () => {
    const diff = generateSimpleDiff("a\nb\nc", "a\nB\nc");
    expect(diff).toEqual([
      { type: "unchanged", content: "a", lineNumber: 1 },
      { type: "removed", content: "b", lineNumber: 2 },
      { type: "added", content: "B", lineNumber: 2 },
      { type: "unchanged", content: "c", lineNumber: 3 },
    ]);
  });

  it("删除行数少于新增行数时补 added", () => {
    const diff = generateSimpleDiff("a", "a\nb\nc");
    expect(diff).toEqual([
      { type: "unchanged", content: "a", lineNumber: 1 },
      { type: "added", content: "b", lineNumber: 2 },
      { type: "added", content: "c", lineNumber: 3 },
    ]);
  });
});

describe("generatePlanDiff", () => {
  it("为计划中每个文件生成 diff（不落盘）", () => {
    const plan = parseCodeBlocks(
      ["```ts", "// filepath: src/a.ts", "new content", "```"].join("\n"),
      { "src/a.ts": "old content" },
    );
    const diffs = generatePlanDiff(plan, { "src/a.ts": "old content" });
    expect(diffs["src/a.ts"]).toEqual([
      { type: "removed", content: "old content", lineNumber: 1 },
      { type: "added", content: "new content", lineNumber: 1 },
    ]);
  });
});
