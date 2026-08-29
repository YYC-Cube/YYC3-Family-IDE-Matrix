/**
 * @file: main.tsx
 * @description: YYC³ IDE Workbench 入口 — 可观测性接线 + 挂载 IdeWorkbench
 * @author: YanYuCloudCube Team <admin@0379.email>
 * @version: v1.1.0
 * @created: 2026-08-28
 * @updated: 2026-08-28
 * @status: active
 * @tags: [entry,main,workbench,observability]
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { IdeWorkbench } from "../components/workbench";
import { errorReporting } from "../services/ErrorReportingService";

// Tailwind CSS
import "../tailwind.css";

// ── 可观测性接线（Phase 1 · P1-1）──

errorReporting.init({
  sampleRate: 1.0,
  environment: (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE ?? "development",
  // DSN 缺省时自动降级 LocalTransport（事件仅存 localStorage，不上报远端）
  ...(import.meta as unknown as { env?: { VITE_SENTRY_DSN?: string } }).env
    ?.VITE_SENTRY_DSN
    ? {
        dsn: (import.meta as unknown as { env?: { VITE_SENTRY_DSN?: string } }).env!
          .VITE_SENTRY_DSN,
      }
    : {},
});

// 面包屑：记录应用启动
errorReporting.addBreadcrumb({
  type: "navigation",
  category: "lifecycle",
  message: "YYC³ IDE Workbench 启动",
});

// ── 根 ErrorBoundary（Phase 1 · P1-1）──

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorId: string | null }
> {
  state = { hasError: false, errorId: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorId: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const id = errorReporting.captureError(error, {
      category: "render",
      severity: "fatal",
      componentStack: errorInfo.componentStack ?? undefined,
    });
    this.setState({ errorId: id });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#0d1117",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "system-ui, sans-serif",
            gap: "16px",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>渲染异常</h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.6 }}>
            错误已上报{this.state.errorId ? `（ID: ${this.state.errorId.slice(0, 8)}…）` : ""}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid rgba(6,182,212,0.3)",
              background: "rgba(6,182,212,0.1)",
              color: "#06b6d4",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 挂载 ──

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <IdeWorkbench />
    </RootErrorBoundary>
  </React.StrictMode>,
);
