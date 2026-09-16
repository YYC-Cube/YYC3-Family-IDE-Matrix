/**
 * @file: postcss.config.js
 * @description: PostCSS 配置 — Tailwind 4 独立插件接入
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v2.0.0
 * @created: 2026-08-19
 * @updated: 2026-09-16
 * @status: active
 * @tags: [postcss,tailwind,config]
 *
 * notes: Tailwind v4 起 PostCSS 插件从主包拆分至 @tailwindcss/postcss，
 *        autoprefixer 已内置于 v4 引擎（含 lightningcss），无需单独注册。
 */

export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
