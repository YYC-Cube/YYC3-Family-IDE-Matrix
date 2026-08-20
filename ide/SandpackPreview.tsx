/**
 * @file: SandpackPreview.tsx
 * @description: Sandpack 预览占位 —— 真身在归档（343 行），迁移需先安装
 *               @codesandbox/sandpack-react 并迁入 FileStore（组装期任务）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-20
 * @updated: 2026-08-20
 * @status: placeholder
 * @tags: [sandbox],[preview],[placeholder]
 * @see archive/ide-monolith-2026-03/SandpackPreview.tsx
 */

import { AppWindow } from "lucide-react";

export default function SandpackPreview(_props: { className?: string }) {
  return (
    <div className="flex size-full items-center justify-center border border-[var(--ide-border-faint)] text-slate-600">
      <div className="flex flex-col items-center gap-2">
        <AppWindow className="h-6 w-6" />
        <span className="text-[0.7rem]">
          Sandpack 预览待接入（需 @codesandbox/sandpack-react + FileStore）
        </span>
      </div>
    </div>
  );
}
