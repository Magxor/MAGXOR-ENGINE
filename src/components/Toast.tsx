import React, { useEffect } from "react";
import { Check, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "info" | "error";
}

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export default function Toast({ toasts, removeToast }: ToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void; key?: string }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 700);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="pointer-events-auto flex items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 dark:bg-white dark:border-neutral-200 text-white dark:text-neutral-900 p-4 rounded-xl shadow-xl transition-all duration-300 animate-slide-in-right ring-1 ring-black/5"
      role="alert"
    >
      <div className="flex items-center gap-3">
        {toast.type === "success" ? (
          <div className="bg-emerald-500/10 text-emerald-400 dark:text-emerald-600 p-1.5 rounded-lg">
            <Check className="w-4 h-4" />
          </div>
        ) : (
          <div className="bg-blue-500/10 text-blue-400 dark:text-blue-600 p-1.5 rounded-lg">
            <Check className="w-4 h-4" />
          </div>
        )}
        <p className="text-sm font-medium">{toast.text}</p>
      </div>
      <button
        onClick={onClose}
        className="text-neutral-400 hover:text-neutral-200 dark:text-neutral-500 dark:hover:text-neutral-800 p-1 rounded-lg transition-colors cursor-pointer"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
