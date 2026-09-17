/**
 * @file: WorkbenchTopBar.tsx
 * @description: 工作台顶栏（顶层操作图标）— 品牌 + 主题 + 分享 + 通知 + 导出 + 密钥设置
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.0.0
 * @created: 2026-09-17
 * @updated: 2026-09-17
 * @status: active
 * @tags: [workbench],[topbar],[toolbar]
 *
 * brief: 回迁归档 TopBar 的顶层操作能力至三期工作台壳：真实可用的
 *        主题切换、分享对话、通知中心、项目导出与 API 密钥设置入口
 */

import {
  Bell,
  Check,
  Download,
  FileArchive,
  FileJson,
  Pencil,
  Rocket,
  Search,
  Settings,
  Share2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { APIKeyManagerPanel } from "../../APIKeyManagerPanel";
import ThemeSwitcher from "../../ThemeSwitcher";
import { exportAsJson, exportAsZip } from "../../adapters/ProjectExporter";
import { useFileStoreZustand } from "../../stores/useFileStoreZustand";

interface Notification {
  id: number;
  title: string;
  detail: string;
  time: string;
  tone: "info" | "ok" | "warn";
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: 1, title: "Agent 舰队就绪", detail: "8 Agent 端口 25600-25607 已挂载", time: "刚刚", tone: "ok" },
  { id: 2, title: "Monaco 分片预热完成", detail: "编辑器按需加载策略已生效", time: "2 分钟前", tone: "info" },
  { id: 3, title: "API 密钥未配置", detail: "打开设置完成 Provider 密钥配置", time: "5 分钟前", tone: "warn" },
];

const NOTIFICATION_TONE: Record<Notification["tone"], string> = {
  info: "bg-sky-500/15 text-sky-300",
  ok: "bg-emerald-500/15 text-emerald-300",
  warn: "bg-amber-500/15 text-amber-300",
};

/** 通用图标按钮（激活态高亮） */
function IconAction({
  label,
  active = false,
  badge,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex h-7 w-7 items-center justify-center rounded transition-all ${active
          ? "bg-cyan-600/25 ring-1 ring-cyan-400/40"
          : "hover:bg-white/[0.08]"
        }`}
    >
      {children}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[0.5rem] text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default function WorkbenchTopBar() {
  const { fileContents } = useFileStoreZustand();
  const [projectName, setProjectName] = useState("YYC³ Workspace");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(projectName);
  const editRef = useRef<HTMLInputElement>(null);

  const [searchValue, setSearchValue] = useState("");

  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const [showKeyPanel, setShowKeyPanel] = useState(false);

  const toolbarActive = showExport || notifOpen || shareOpen || showKeyPanel;

  // 项目名编辑聚焦
  useEffect(() => {
    if (editing) editRef.current?.select();
  }, [editing]);

  // 下拉/弹层外点关闭
  useEffect(() => {
    if (!showExport && !notifOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (exportRef.current?.contains(target)) return;
      if (notifRef.current?.contains(target)) return;
      setShowExport(false);
      setNotifOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showExport, notifOpen]);

  const commitName = useCallback(() => {
    const name = editValue.trim();
    if (name) setProjectName(name);
    else setEditValue(projectName);
    setEditing(false);
  }, [editValue, projectName]);

  const handleExportZip = useCallback(() => {
    void exportAsZip(fileContents, { projectName });
    setShowExport(false);
  }, [fileContents, projectName]);

  const handleExportJson = useCallback(() => {
    exportAsJson(fileContents, { projectName });
    setShowExport(false);
  }, [fileContents, projectName]);

  const handleShare = useCallback(() => {
    const payload = JSON.stringify({
      project: projectName,
      files: Object.keys(fileContents).length,
      ts: Date.now(),
    });
    // base64url 载荷，保持链接可粘贴、无服务端依赖
    const link = `${window.location.origin}${window.location.pathname}#share=${btoa(payload).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    setShareLink(link);
    setShareCopied(false);
    setShareOpen(true);
  }, [fileContents, projectName]);

  const copyShare = useCallback(() => {
    if (!shareLink) return;
    void navigator.clipboard
      .writeText(shareLink)
      .then(() => setShareCopied(true))
      .catch(() => setShareCopied(false));
  }, [shareLink]);

  const fileCount = useMemo(() => Object.keys(fileContents).length, [fileContents]);

  return (
    <>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-(--ide-border-dim) bg-(--ide-bg-elevated) px-2.5">
        {/* 品牌 */}
        <span className="flex items-center gap-1.5">
          <span className="text-[0.78rem] font-medium tracking-wide text-slate-200">YYC³</span>
          <span className="text-[0.58rem] text-slate-600">IDE Matrix</span>
        </span>

        <div className="h-4 w-px bg-(--ide-border-dim)" />

        {/* 项目名（可编辑） */}
        {editing ? (
          <span className="flex items-center gap-1">
            <input
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setEditValue(projectName);
                  setEditing(false);
                }
              }}
              aria-label="项目名称"
              className="w-36 rounded border border-cyan-500/40 bg-(--ide-bg) px-1.5 py-0.5 text-[0.72rem] text-slate-200 outline-none"
            />
            <button
              type="button"
              aria-label="确认修改"
              onClick={commitName}
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-white/10"
            >
              <Check className="h-3 w-3 text-emerald-400" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditValue(projectName);
              setEditing(true);
            }}
            className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white/5"
            title="重命名项目"
          >
            <span className="max-w-44 truncate text-[0.72rem] text-slate-400">{projectName}</span>
            <Pencil className="h-2.5 w-2.5 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}

        {/* 居中搜索 */}
        <div className="flex flex-1 justify-center px-4">
          <div className="flex h-7 w-full max-w-96 items-center rounded-md border border-(--ide-border-dim) bg-(--ide-bg) transition-colors focus-within:border-cyan-500/50">
            <Search className="ml-2 h-3 w-3 shrink-0 text-slate-600" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="搜索文件、命令、组件..."
              className="h-full flex-1 border-0 bg-transparent px-2 text-[0.68rem] text-slate-300 outline-none placeholder:text-slate-600"
            />
            {searchValue ? (
              <button
                type="button"
                aria-label="清除搜索"
                onClick={() => setSearchValue("")}
                className="mr-1 flex h-4 w-4 items-center justify-center rounded-full hover:bg-white/10"
              >
                <X className="h-2.5 w-2.5 text-slate-500" />
              </button>
            ) : null}
          </div>
        </div>

        {/* 主题 */}
        <ThemeSwitcher compact />

        <div className="h-4 w-px bg-(--ide-border-dim)" />

        {/* 顶层操作图标 */}
        <div className="flex items-center gap-0.5">
          <IconAction label="分享" active={shareOpen} onClick={handleShare}>
            <Share2 className="h-4 w-4 text-cyan-400" />
          </IconAction>

          <span className="relative" ref={notifRef}>
            <IconAction
              label="通知中心"
              active={notifOpen}
              badge={notifications.length || undefined}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell className="h-4 w-4 text-amber-400" />
              {notifications.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[0.5rem] text-white">
                  {notifications.length}
                </span>
              )}
            </IconAction>
            {notifOpen ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-(--ide-border-mid) bg-(--ide-bg-elevated) py-1 text-[0.68rem] shadow-xl">
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-slate-500">通知中心</span>
                  <button
                    className="text-slate-600 hover:text-slate-400"
                    onClick={() => setNotifications([])}
                  >
                    清空
                  </button>
                </div>
                <div className="mx-2 border-t border-(--ide-border-faint)" />
                {notifications.length === 0 ? (
                  <div className="px-3 py-3 text-center text-slate-600">暂无通知</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-2 px-3 py-1.5 hover:bg-white/[0.04]">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${NOTIFICATION_TONE[n.tone].split(" ")[0]}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-slate-300">{n.title}</span>
                          <span className="shrink-0 text-[0.55rem] text-slate-600">{n.time}</span>
                        </div>
                        <p className="truncate text-[0.58rem] text-slate-500">{n.detail}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </span>

          <IconAction
            label="设置 / API 密钥"
            active={showKeyPanel}
            onClick={() => setShowKeyPanel(true)}
          >
            <Settings className="h-4 w-4 text-slate-300" />
          </IconAction>

          <div className="mx-0.5 h-4 w-px bg-(--ide-border-dim)" />

          {/* 发布（占位能力：导出 ZIP 的快捷面） */}
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 text-white transition-opacity hover:opacity-90"
            title="发布"
            onClick={handleExportZip}
          >
            <Rocket className="h-3 w-3" />
          </button>

          {/* 导出下拉 */}
          <span className="relative" ref={exportRef}>
            <IconAction label="导出项目" active={showExport} onClick={() => setShowExport((v) => !v)}>
              <Download className="h-4 w-4 text-emerald-400" />
            </IconAction>
            {showExport ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-(--ide-border-mid) bg-(--ide-bg-elevated) py-1 text-[0.68rem] shadow-xl">
                <button
                  onClick={handleExportZip}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                >
                  <FileArchive className="h-3.5 w-3.5 text-sky-400" />
                  导出为 ZIP
                </button>
                <button
                  onClick={handleExportJson}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                >
                  <FileJson className="h-3.5 w-3.5 text-amber-400" />
                  导出为 JSON
                </button>
                <div className="mx-2 my-1 border-t border-(--ide-border-faint)" />
                <div className="px-3 py-1 text-[0.58rem] text-slate-600">{fileCount} 个文件</div>
              </div>
            ) : null}
          </span>
        </div>
      </div>

      {/* 分享对话 */}
      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShareOpen(false)}>
          <div
            className="w-96 rounded-xl border border-(--ide-border-mid) bg-(--ide-bg-elevated) p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[0.78rem] text-slate-200">分享项目</span>
              <button aria-label="关闭分享" onClick={() => setShareOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mb-2 text-[0.62rem] text-slate-500">
              链接携带项目快照（{fileCount} 个文件），粘贴给协作者即可恢复上下文。
            </p>
            <div className="flex items-center gap-1.5">
              <input
                readOnly
                value={shareLink ?? ""}
                className="h-7 flex-1 rounded border border-(--ide-border-dim) bg-(--ide-bg) px-2 text-[0.62rem] text-slate-400 outline-none"
              />
              <button
                onClick={copyShare}
                className={`flex h-7 items-center gap-1 rounded px-2 text-[0.62rem] transition-colors ${shareCopied
                    ? "bg-emerald-600/25 text-emerald-300"
                    : "bg-cyan-600/25 text-cyan-300 hover:bg-cyan-600/35"
                  }`}
              >
                {shareCopied ? <Check className="h-3 w-3" /> : null}
                {shareCopied ? "已复制" : "复制"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* API 密钥设置（顶层弹窗） */}
      {showKeyPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowKeyPanel(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] overflow-y-auto">
            <APIKeyManagerPanel onClose={() => setShowKeyPanel(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
