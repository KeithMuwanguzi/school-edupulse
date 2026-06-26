"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

export interface RevealSecretOptions {
  title: string;
  description?: string;
  secret: string;
  secretLabel?: string;
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  revealSecret: (options: RevealSecretOptions) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useConfirm(): DialogContextValue["confirm"] {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useConfirm must be used within <DialogProvider>");
  return ctx.confirm;
}

export function useRevealSecret(): DialogContextValue["revealSecret"] {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useRevealSecret must be used within <DialogProvider>");
  return ctx.revealSecret;
}

type ActiveDialog =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "secret"; options: RevealSecretOptions; resolve: () => void };

function DialogShell({
  title,
  description,
  tone = "default",
  onClose,
  children,
}: {
  title: string;
  description?: string;
  tone?: "default" | "danger";
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_32px_80px_-24px_rgba(15,40,36,0.55)] animate-auth-in">
        <div
          className={cn(
            "px-5 py-4",
            tone === "danger" ? "bg-red-700 text-white" : "bg-brand-700 text-white",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                tone === "danger" ? "bg-white/15" : "bg-white/10 ring-1 ring-white/15",
              )}
            >
              <Icon
                name={tone === "danger" ? "alert-triangle" : "shield"}
                size={18}
              />
            </span>
            <div className="min-w-0">
              <h2 id="dialog-title" className="font-display text-[1.1rem] font-medium leading-tight">
                {title}
              </h2>
              {description && (
                <p
                  className={cn(
                    "mt-1.5 text-[12px] leading-relaxed",
                    tone === "danger" ? "text-red-100" : "text-brand-100",
                  )}
                >
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const activeRef = useRef<ActiveDialog | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const entry: ActiveDialog = { kind: "confirm", options, resolve };
      activeRef.current = entry;
      setActive(entry);
    });
  }, []);

  const revealSecret = useCallback((options: RevealSecretOptions) => {
    return new Promise<void>((resolve) => {
      const entry: ActiveDialog = { kind: "secret", options, resolve };
      activeRef.current = entry;
      setActive(entry);
    });
  }, []);

  function closeConfirm(result: boolean) {
    const current = activeRef.current;
    if (current?.kind === "confirm") {
      current.resolve(result);
      activeRef.current = null;
      setActive(null);
    }
  }

  function closeSecret() {
    const current = activeRef.current;
    if (current?.kind === "secret") {
      current.resolve();
      activeRef.current = null;
      setActive(null);
    }
  }

  return (
    <DialogContext.Provider value={{ confirm, revealSecret }}>
      {children}
      {active?.kind === "confirm" && (
        <DialogShell
          title={active.options.title}
          description={active.options.description}
          tone={active.options.tone ?? "default"}
          onClose={() => closeConfirm(false)}
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => closeConfirm(false)}>
              {active.options.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              size="sm"
              variant={active.options.tone === "danger" ? "danger" : "primary"}
              onClick={() => closeConfirm(true)}
            >
              {active.options.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </DialogShell>
      )}
      {active?.kind === "secret" && (
        <SecretDialog
          options={active.options}
          onClose={closeSecret}
        />
      )}
    </DialogContext.Provider>
  );
}

function SecretDialog({
  options,
  onClose,
}: {
  options: RevealSecretOptions;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(options.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <DialogShell title={options.title} description={options.description} onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {options.secretLabel ?? "Temporary password"}
        </label>
        <div className="flex gap-2">
          <code className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[13px] text-slate-800">
            {options.secret}
          </code>
          <Button size="sm" variant="secondary" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="text-[10.5px] text-slate-500">
          Share securely. The user must change this password on first sign-in.
        </p>
        <div className="flex justify-end">
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
