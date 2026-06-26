"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  requestId?: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone, requestId?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const toneStyles: Record<ToastTone, string> = {
  success: "border-brand-200 bg-brand-50 text-brand-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-200 bg-white text-slate-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    (message: string, tone: ToastTone = "info", requestId?: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, tone, requestId }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg border px-3.5 py-2.5 text-[12px] shadow-card",
              toneStyles[t.tone],
            )}
          >
            <p>{t.message}</p>
            {t.requestId && (
              <button
                onClick={() => navigator.clipboard?.writeText(t.requestId!)}
                className="mt-1 text-[10px] underline opacity-70 hover:opacity-100"
              >
                Ref: {t.requestId.slice(0, 8)} — copy
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
