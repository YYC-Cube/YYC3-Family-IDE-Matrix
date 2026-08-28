/**
 * @file: main.tsx
 * @description: YYC³ IDE Workbench 入口 — 挂载 IdeWorkbench 并注入 Tailwind
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-28
 * @updated: 2026-08-28
 * @status: active
 * @tags: [entry,main,workbench]
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { IdeWorkbench } from "../components/workbench";

// Tailwind CSS（全量——生产可按需精简 tailwind.config purge 范围）
import "../tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <IdeWorkbench />
  </React.StrictMode>,
);
