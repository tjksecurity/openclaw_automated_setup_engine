"use client";

// Minimal toast strip for surfacing errors. Renders whatever messages the
// wizard pushes in; auto-dismisses after 6s unless the message is a hard
// error (which requires an explicit dismiss).

import { useEffect } from "react";

export type ToastKind = "error" | "warning" | "info" | "success";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

const KIND_CLASS: Record<ToastKind, string> = {
  error: "border-red-800 bg-red-950/60 text-red-100",
  warning: "border-amber-800 bg-amber-950/60 text-amber-100",
  info: "border-zinc-700 bg-zinc-900 text-zinc-100",
  success: "border-emerald-800 bg-emerald-950/60 text-emerald-100",
};

export function ToastStrip({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.kind === "error") return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [toast.kind, onDismiss]);
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm shadow-lg ${KIND_CLASS[toast.kind]}`}
      role={toast.kind === "error" ? "alert" : "status"}
    >
      <div className="flex items-start justify-between gap-3">
        <span>{toast.message}</span>
        <button
          onClick={onDismiss}
          className="text-xs text-current opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="mt-2 rounded border border-current px-2 py-0.5 text-xs opacity-90 hover:opacity-100"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
