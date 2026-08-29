/**
 * @file: EditorTabs.tsx
 * @description: 编辑器 Tab 栏 — 多文件切换 / 关闭 / 脏标记（Phase 3 P3-1）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-28
 * @updated: 2026-08-28
 * @status: active
 * @tags: [editor,tabs,multi-file,phase-3]
 */

import { X, Circle } from "lucide-react";
import { useFileStoreZustand } from "../../stores/useFileStoreZustand";

// ── 文件类型标签色 ──

function getLangColor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts": case "tsx": return "text-blue-400";
    case "js": case "jsx": return "text-yellow-400";
    case "css": case "scss": return "text-pink-400";
    case "json": return "text-amber-400";
    case "html": return "text-orange-400";
    case "md": return "text-slate-400";
    default: return "text-slate-500";
  }
}

export default function EditorTabs() {
  const { recentFiles, currentFilePath, openFile, closeFile } = useFileStoreZustand((s) => ({ recentFiles: s.recentFiles, currentFilePath: s.currentFilePath, openFile: s.openFile, closeFile: s.closeFile }));

  if (recentFiles.length === 0) return null;

  return (
    <div className="flex h-8 flex-shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--ide-border-dim)] bg-[var(--ide-bg-elevated)] px-1">
      {recentFiles.map((path) => {
        const isCurrent = path === currentFilePath;
        const fileName = path.split("/").pop() ?? path;
        const langColor = getLangColor(path);

        return (
          <div
            key={path}
            className={`group flex h-6 items-center gap-1 rounded-t px-2 text-[0.65rem] transition-colors cursor-pointer select-none ${
              isCurrent
                ? "bg-[var(--ide-bg)] text-slate-200 border-t border-x border-[var(--ide-border-mid)]"
                : "text-slate-500 hover:bg-white/5"
            }`}
            onClick={() => openFile(path)}
            title={path}
          >
            <Circle className={`h-1.5 w-1.5 ${langColor} fill-current`} />
            <span className="max-w-[100px] truncate">{fileName}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(path);
              }}
              className="ml-1 hidden p-0.5 rounded group-hover:block hover:bg-red-500/20 hover:text-red-400"
              title="关闭"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
