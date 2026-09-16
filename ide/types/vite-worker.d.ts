/**
 * @file: types/vite-worker.d.ts
 * @description: monaco-worker:* 别名导入的类型声明（Monaco Worker URL 引用）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-09-16
 * @updated: 2026-09-16
 * @status: active
 * @tags: [type],[vite],[worker],[ambient]
 *
 * notes:
 * - Vite 8（rolldown）下裸包 worker 路径经 new URL() 无法在构建期解析，
 *   且 monaco-editor 0.56 的 exports 通配不跨目录；
 *   vite.config.ts 以 monaco-worker:{label} alias 指向磁盘真实 worker 文件
 *   并附加 ?worker&url，本声明补齐 tsc 所需模块类型（string URL）
 */

declare module "monaco-worker:json" {
  const workerUrl: string;
  export default workerUrl;
}
declare module "monaco-worker:css" {
  const workerUrl: string;
  export default workerUrl;
}
declare module "monaco-worker:html" {
  const workerUrl: string;
  export default workerUrl;
}
declare module "monaco-worker:ts" {
  const workerUrl: string;
  export default workerUrl;
}
declare module "monaco-worker:editor" {
  const workerUrl: string;
  export default workerUrl;
}
