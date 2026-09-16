/**
 * Tailwind v4 类名风格收敛 codemod
 *
 * 四类官方推荐的 v4 简写（等价改写，产物 CSS 不变）：
 *  1. 透明度：bg-white/[0.02] → bg-white/2（任意值百分数 → 整数百分数）
 *  2. CSS 变量：bg-[var(--x)] → bg-(--x)（任意值 → 变量简写语法）
 *  3. flex-shrink-0 → shrink-0（v3 旧名 → v4 标准名）
 *  4. 4px 网格任意值：w-[280px] → w-70、max-h-[400px] → max-h-100
 *
 * 范围：ide/ 下 .ts/.tsx（跳过 node_modules / dist / .css-baseline）
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "ide");
const SKIP = new Set(["node_modules", "dist", ".css-baseline", "coverage", "collab-server", "electron"]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

// 类名 token 须整体匹配（前后是引号/空白/字符串拼接边界），避免误伤 prose 文本
const rules = [
  // 1) 任意值透明度 → 整数百分数：white/[0.02] → white/2；emerald-500/[0.05] → emerald-500/5
  {
    re: /((?:hover:|focus:|placeholder:)?[a-z-]+-white|\b(?:hover:|focus:)?(?:red|blue|emerald|amber|indigo|green|slate|rose)-500)\/\[0\.(\d+)\]/g,
    sub: (m, pre, d) => `${pre}/${Number(d) * 10}`,
    note: "opacity-arbitrary",
  },
  // 2) CSS 变量任意值 → v4 变量简写：bg-[var(--x)] → bg-(--x)（含 variant 前缀）
  {
    re: /([a-z-]+(?:-(?:[a-z-]+))*)-\[var\((--[a-z0-9-]+)\)\]/g,
    sub: (m, util, v) => `${util}-(${v})`,
    note: "css-var",
  },
  // 3) v3 旧名
  { re: /\bflex-shrink-0\b/g, sub: () => "shrink-0", note: "shrink-0" },
  // 4) 4px 网格任意值（仅白名单尺寸，防误伤）
  {
    re: /\b(w)-\[280px\]/g,
    sub: (m, u) => `${u}-70`,
    note: "spacing",
  },
  { re: /\b(max-h)-\[400px\]/g, sub: (m, u) => `${u}-100`, note: "spacing" },
];

let totalChanges = 0;
const byNote = {};
const byFile = {};

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, "utf8");
  let out = src;
  let fileChanges = 0;
  for (const { re, sub, note } of rules) {
    out = out.replace(re, (...args) => {
      const res = sub(...args);
      fileChanges++;
      byNote[note] = (byNote[note] || 0) + 1;
      return res;
    });
  }
  if (out !== src) {
    fs.writeFileSync(file, out);
    totalChanges += fileChanges;
    byFile[path.relative(ROOT, file)] = fileChanges;
  }
}

console.log(`total: ${totalChanges}`);
console.log("by rule:", JSON.stringify(byNote, null, 2));
console.log("by file:", JSON.stringify(byFile, null, 2));
