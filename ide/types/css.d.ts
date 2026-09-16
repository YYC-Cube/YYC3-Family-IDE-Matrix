/**
 * @file: types/css.d.ts
 * @description: CSS 副作用导入的类型声明（Vite 场景下 TS 无法识别 *.css 模块）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-16
 * @updated: 2026-09-16
 * @status: active
 * @tags: [type],[css],[ambient]
 *
 * notes:
 * - TS 7（tsgo）对未声明模块的副作用导入报 TS2882，且不再默认宽容
 * - 本声明使 `import "../tailwind.css"` 合法化；vite/client 的 CSS 模块声明
 *   在本项目的 tsconfig include 范围内不可用（无 src/vite-env.d.ts）
 */

declare module "*.css";
