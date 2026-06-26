"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export interface WizardStep {
  id: string;
  label: string;
  complete?: boolean;
  optional?: boolean;
}

interface WizardFlowProps {
  steps: WizardStep[];
  activeStepId: string;
  onStepChange: (stepId: string) => void;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onSave?: () => void;
  backLabel?: string;
  nextLabel?: string;
  saveLabel?: string;
  saving?: boolean;
  readOnly?: boolean;
  extraActions?: ReactNode;
}

export function WizardFlow({
  steps,
  activeStepId,
  onStepChange,
  children,
  onBack,
  onNext,
  onSave,
  backLabel = "Previous",
  nextLabel = "Next section",
  saveLabel = "Save & continue",
  saving = false,
  readOnly = false,
  extraActions,
}: WizardFlowProps) {
  const activeIndex = steps.findIndex((s) => s.id === activeStepId);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="flex min-w-max items-center gap-1">
          {steps.map((step, index) => {
            const active = step.id === activeStepId;
            const done = step.complete;
            return (
              <li key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onStepChange(step.id)}
                  className={cn(
                    "flex max-w-[9rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-left transition-colors sm:max-w-none sm:px-3",
                    active
                      ? "border-brand-300 bg-brand-50 text-brand-900"
                      : done
                        ? "border-brand-100 bg-white text-brand-800 hover:bg-brand-50/50"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      active
                        ? "bg-brand-600 text-white"
                        : done
                          ? "bg-brand-100 text-brand-700"
                          : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {done && !active ? <Icon name="check" size={11} /> : index + 1}
                  </span>
                  <span className="truncate text-[11px] font-medium">{step.label}</span>
                </button>
                {index < steps.length - 1 && (
                  <span aria-hidden className="mx-0.5 hidden h-px w-3 bg-slate-200 sm:inline-block" />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div>{children}</div>

      {!readOnly && (
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {onBack && activeIndex > 0 && (
              <Button size="sm" variant="ghost" onClick={onBack} disabled={saving}>
                {backLabel}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {extraActions}
            {onSave && (
              <Button size="sm" variant="secondary" loading={saving} onClick={onSave}>
                {saveLabel}
              </Button>
            )}
            {onNext && activeIndex < steps.length - 1 && (
              <Button size="sm" loading={saving} onClick={onNext}>
                {nextLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
