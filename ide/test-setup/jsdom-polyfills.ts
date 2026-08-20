/**
 * @file: jsdom-polyfills.ts
 * @description: Vitest 全局 setup — 补齐 jsdom 25 缺失的浏览器 API
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: active
 * @tags: [test],[setup],[polyfill],[jsdom]
 *
 * brief: jsdom 25 的 Blob/File 未实现 W3C 的 .text()（真实浏览器均有），
 *        涉及文件读取的存储/迁移类测试在无此 polyfill 时必失败
 */

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// ── Blob/File.prototype.text polyfill（经 FileReader 实现）──
function blobTextPolyfill(this: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(this);
  });
}

if (typeof Blob !== "undefined" && typeof Blob.prototype.text !== "function") {
  Blob.prototype.text = blobTextPolyfill;
}
if (typeof File !== "undefined" && typeof File.prototype.text !== "function") {
  File.prototype.text = blobTextPolyfill;
}

// ── RTL 组件卸载清理（避免跨用例 DOM 泄漏）──
afterEach(() => {
  cleanup();
});
