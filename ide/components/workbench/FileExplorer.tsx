/**
 * @file: FileExplorer.tsx
 * @description: 文件浏览器 — 文件树渲染 / 点击切换 / 新建 / 删除（Phase 3 P3-1）
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-08-28
 * @updated: 2026-08-28
 * @status: active
 * @tags: [files,explorer,tree,phase-3]
 */

import { useCallback, useMemo, useState } from "react";
import {
  File, FilePlus, Folder, FolderOpen, Trash2, ChevronRight, ChevronDown,
  Search, FileCode, FileJson, FileText, FileType, Braces,
} from "lucide-react";
import { PanelHeader } from "../panel-host";
import { useFileStoreZustand } from "../../stores/useFileStoreZustand";

// ── 文件类型图标映射 ──

function FileIcon({ path }: { path: string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  const cls = "h-3.5 w-3.5 flex-shrink-0";
  switch (ext) {
    case "ts": case "tsx":
      return <FileCode className={`${cls} text-blue-400`} />;
    case "js": case "jsx": case "mjs":
      return <FileCode className={cls + " text-yellow-400"} />;
    case "json":
      return <FileJson className={cls + " text-amber-400"} />;
    case "css": case "scss": case "less":
      return <FileType className={cls + " text-pink-400"} />;
    case "html":
      return <FileCode className={cls + " text-orange-400"} />;
    case "md": case "mdx":
      return <FileText className={cls + " text-slate-400"} />;
    case "yml": case "yaml":
      return <Braces className={cls + " text-purple-400"} />;
    default:
      return <File className={`${cls} text-slate-500`} />;
  }
}

// ── 文件树节点 ──

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };

  for (const path of paths.sort()) {
    const parts = path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");
      const existing = current.children.find((c) => c.name === name);

      if (existing) {
        current = existing;
      } else {
        const node: TreeNode = {
          name,
          path: fullPath,
          isDirectory: !isLast,
          children: [],
        };
        current.children.push(node);
        current = node;
      }
    }
  }

  return root;
}

// ── 树节点渲染 ──

function TreeItem({
  node,
  depth,
  currentFilePath,
  onOpen,
  expandedDirs,
  toggleDir,
}: {
  node: TreeNode;
  depth: number;
  currentFilePath: string | null;
  onOpen: (path: string) => void;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
}) {
  const isExpanded = expandedDirs.has(node.path);
  const isCurrent = currentFilePath === node.path;
  const paddingLeft = `${depth * 14 + 8}px`;

  if (node.isDirectory) {
    return (
      <>
        <button
          onClick={() => toggleDir(node.path)}
          className="flex w-full items-center gap-1 py-0.5 text-left text-[0.68rem] hover:bg-white/5"
          style={{ paddingLeft }}
        >
          {isExpanded
            ? <ChevronDown className="h-3 w-3 text-slate-500" />
            : <ChevronRight className="h-3 w-3 text-slate-500" />}
          {isExpanded
            ? <FolderOpen className="h-3.5 w-3.5 text-cyan-400/70" />
            : <Folder className="h-3.5 w-3.5 text-cyan-400/70" />}
          <span className="truncate text-slate-300">{node.name}</span>
        </button>
        {isExpanded && node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            currentFilePath={currentFilePath}
            onOpen={onOpen}
            expandedDirs={expandedDirs}
            toggleDir={toggleDir}
          />
        ))}
      </>
    );
  }

  return (
    <button
      onClick={() => onOpen(node.path)}
      className={`flex w-full items-center gap-1 py-0.5 text-left text-[0.68rem] transition-colors ${
        isCurrent ? "bg-cyan-600/20 text-cyan-300" : "text-slate-400 hover:bg-white/5"
      }`}
      style={{ paddingLeft: `${depth * 14 + 22}px` }}
    >
      <FileIcon path={node.path} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ── 主面板 ──

export default function FileExplorer({ nodeId }: { nodeId: string }) {
  const store = useFileStoreZustand();
  const fileContents = store.fileContents;
  const currentFilePath = store.currentFilePath;
  const openFile = store.openFile;
  const deleteFile = store.deleteFile;
  const initializeProject = store.initializeProject;
  const [search, setSearch] = useState("");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(["src"]));

  const paths = useMemo(() => {
    const all = Object.keys(fileContents);
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((p) => p.toLowerCase().includes(q));
  }, [fileContents, search]);

  const tree = useMemo(() => buildTree(paths), [paths]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleNewFile = useCallback(() => {
    const name = prompt("新文件名（含路径）:");
    if (!name) return;
    initializeProject({ ...fileContents, [name]: "// 新文件\n" }, name);
  }, [fileContents, initializeProject]);

  const handleDelete = useCallback(() => {
    if (!currentFilePath) return;
    if (!confirm(`删除 ${currentFilePath}？`)) return;
    deleteFile(currentFilePath);
  }, [currentFilePath, deleteFile]);

  return (
    <div className="panel-host-root flex size-full flex-col bg-[var(--ide-bg)]">
      <PanelHeader
        nodeId={nodeId}
        panelId="files"
        title="文件"
        icon={<Folder className="h-3 w-3 text-cyan-400/70" />}
      >
        <button
          title="新建文件"
          onClick={handleNewFile}
          className="p-0.5 text-slate-600 hover:text-cyan-400"
        >
          <FilePlus className="h-3 w-3" />
        </button>
        <button
          title="删除当前文件"
          onClick={handleDelete}
          disabled={!currentFilePath}
          className="p-0.5 text-slate-600 hover:text-red-400 disabled:opacity-30"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </PanelHeader>

      {/* 搜索 */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-[var(--ide-border-faint)]">
        <div className="flex items-center gap-1.5 bg-[var(--ide-bg-elevated)] border border-[var(--ide-border-mid)] rounded px-2 py-1">
          <Search className="h-3 w-3 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索文件..."
            className="flex-1 bg-transparent border-0 outline-none text-[0.68rem] text-slate-300 placeholder:text-slate-700"
          />
        </div>
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-y-auto py-1">
        {paths.length === 0 ? (
          <div className="flex size-full items-center justify-center text-[0.65rem] text-slate-600">
            {search ? "无匹配文件" : "项目为空（新建文件开始）"}
          </div>
        ) : (
          tree.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={0}
              currentFilePath={currentFilePath}
              onOpen={openFile}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
            />
          ))
        )}
      </div>

      {/* 状态栏 */}
      <div className="flex-shrink-0 border-t border-[var(--ide-border-faint)] px-2 py-1">
        <span className="text-[0.55rem] text-slate-600">
          {paths.length} 文件 · {currentFilePath ? `当前: ${currentFilePath.split("/").pop()}` : "无选中"}
        </span>
      </div>
    </div>
  );
}
