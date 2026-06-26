"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { markSetupCelebrated, type SetupEvaluation, type SetupStepState } from "@/lib/schoolSetup";

type Phase = "welcome" | "checklist" | "celebration";

interface Props {
  evaluation: SetupEvaluation;
  schoolName: string;
  schoolCode: string;
  badgeUrl?: string | null;
  onSkipStep: (stepId: string) => void;
  onSkipAllOptional: () => void;
  onEnterWorkingMode: () => void;
  onCelebrated: () => void;
}

function ProgressRing({ pct, size = 88 }: { pct: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E5A627"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[1.35rem] font-medium leading-none text-white">
          {Math.round(pct)}%
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-brand-100">
          ready
        </span>
      </div>
    </div>
  );
}

function StepRow({
  step,
  highlight,
  onSkip,
  onWork,
}: {
  step: SetupStepState;
  highlight: boolean;
  onSkip?: () => void;
  onWork: () => void;
}) {
  const status = step.done ? "done" : step.skipped ? "skipped" : "pending";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-all duration-300",
        highlight && !step.resolved
          ? "border-gold-300/80 bg-gold-50/90 shadow-[0_8px_24px_-12px_rgba(229,166,39,0.35)]"
          : step.resolved
            ? "border-brand-100 bg-brand-50/40"
            : "border-slate-200/80 bg-white hover:border-brand-200",
      )}
    >
      {highlight && !step.resolved && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-gold-300 to-gold-500"
        />
      )}
      <div className="flex items-start gap-3 p-3.5 pl-4">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 transition-colors",
            status === "done"
              ? "bg-brand-600 text-white ring-brand-600"
              : status === "skipped"
                ? "bg-slate-100 text-slate-400 ring-slate-200"
                : "bg-brand-50 text-brand-600 ring-brand-100",
          )}
        >
          {status === "done" ? (
            <Icon name="check" size={16} className="[&>circle]:hidden" />
          ) : status === "skipped" ? (
            <Icon name="minus" size={16} />
          ) : (
            <Icon name={step.icon} size={16} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-[12.5px] font-semibold tracking-tight",
                step.resolved ? "text-slate-500" : "text-slate-900",
              )}
            >
              {step.title}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
                step.tier === "mandatory"
                  ? "bg-brand-100 text-brand-700"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              {step.tier === "mandatory" ? "Required" : "Optional"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{step.description}</p>

          {!step.resolved && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Link href={step.href} onClick={onWork}>
                <Button size="sm" variant={highlight ? "accent" : "primary"}>
                  {step.tier === "mandatory" ? "Set up now" : "Configure"}
                  <Icon name="arrow-right" size={13} />
                </Button>
              </Link>
              {step.tier === "optional" && onSkip && (
                <Button size="sm" variant="ghost" onClick={onSkip}>
                  Set later
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepSection({
  title,
  subtitle,
  steps,
  nextId,
  onSkipStep,
  onEnterWorkingMode,
}: {
  title: string;
  subtitle: string;
  steps: SetupStepState[];
  nextId: string | null;
  onSkipStep: (id: string) => void;
  onEnterWorkingMode: () => void;
}) {
  if (steps.length === 0) return null;

  const done = steps.filter((s) => s.resolved).length;

  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
        </div>
        <span className="shrink-0 text-[10.5px] font-semibold text-slate-400">
          {done}/{steps.length}
        </span>
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            highlight={step.id === nextId}
            onSkip={step.tier === "optional" ? () => onSkipStep(step.id) : undefined}
            onWork={onEnterWorkingMode}
          />
        ))}
      </div>
    </section>
  );
}

export function SchoolSetupExperience({
  evaluation,
  schoolName,
  schoolCode,
  badgeUrl,
  onSkipStep,
  onSkipAllOptional,
  onEnterWorkingMode,
  onCelebrated,
}: Props) {
  const [phase, setPhase] = useState<Phase>("welcome");
  const pct =
    evaluation.totalApplicable > 0
      ? (evaluation.totalResolved / evaluation.totalApplicable) * 100
      : 0;
  const mandatoryComplete = evaluation.mandatoryDone === evaluation.mandatoryTotal;
  const pendingOptional = evaluation.optional.filter((s) => !s.resolved);

  useEffect(() => {
    if (evaluation.isComplete && phase === "checklist") {
      setPhase("celebration");
    }
  }, [evaluation.isComplete, phase]);

  useEffect(() => {
    if (phase !== "celebration") return;
    const t = window.setTimeout(() => {
      markSetupCelebrated(schoolCode);
      onCelebrated();
    }, 2400);
    return () => window.clearTimeout(t);
  }, [phase, schoolCode, onCelebrated]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-title"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[3px] animate-auth-in"
      />

      <div className="relative flex max-h-[96vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-white shadow-[0_32px_80px_-24px_rgba(15,40,36,0.55)] animate-auth-in sm:rounded-2xl">
        {/* Brand header */}
        <div className="relative shrink-0 overflow-hidden bg-brand-700 px-5 pb-5 pt-5 text-white sm:px-6 sm:pt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(480px 240px at 100% 0%, rgba(229,166,39,0.28) 0%, transparent 55%), radial-gradient(360px 280px at -10% 110%, rgba(15,40,36,0.5) 0%, transparent 60%)",
            }}
          />
          <div className="relative flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-300">
                <span aria-hidden className="h-1 w-4 rounded-full bg-gold-400" />
                SkulPulse onboarding
              </p>
              <h2 id="setup-title" className="mt-2 font-display text-[1.45rem] font-medium leading-tight tracking-tight sm:text-[1.65rem]">
                {phase === "celebration"
                  ? "You're ready to go live"
                  : phase === "welcome"
                    ? `Welcome, ${schoolName}`
                    : "Your launch checklist"}
              </h2>
              <p className="mt-2 max-w-md text-[12px] leading-relaxed text-brand-100">
                {phase === "welcome" &&
                  "You've joined a school platform built for Ugandan institutions — polished, dependable, and unmistakably yours."}
                {phase === "checklist" &&
                  "Complete the essentials to unlock day-to-day operations. Optional steps can wait — we'll remind you until you're fully set."}
                {phase === "celebration" &&
                  "Every required step is in place. Your portal is ready for staff, learners, and guardians."}
              </p>
            </div>
            {phase !== "celebration" && (
              <ProgressRing pct={pct} />
            )}
          </div>

          {badgeUrl && phase === "welcome" && (
            <div className="relative mt-4 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={badgeUrl}
                alt=""
                className="h-10 w-10 rounded-lg bg-white object-contain p-0.5"
              />
              <p className="text-[11px] text-brand-100">
                Your crest will appear on reports, receipts, and this portal.
              </p>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {phase === "welcome" && (
            <div className="space-y-4">
              <ul className="grid gap-2.5 sm:grid-cols-3">
                {[
                  { icon: "spark", label: "Premium experience", hint: "Branded portal & reports" },
                  { icon: "shield", label: "Safe imports", hint: "Guided CSV workflows" },
                  { icon: "pulse", label: "Fast go-live", hint: "Step-by-step checklist" },
                ].map((item) => (
                  <li
                    key={item.label}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 text-center"
                  >
                    <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                      <Icon name={item.icon} size={15} />
                    </span>
                    <p className="mt-2 text-[11px] font-semibold text-slate-800">{item.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{item.hint}</p>
                  </li>
                ))}
              </ul>
              <p className="text-center text-[11px] text-slate-500">
                {evaluation.mandatoryTotal} required steps · {evaluation.optionalTotal} recommended
                when you are ready
              </p>
            </div>
          )}

          {phase === "checklist" && (
            <div className="space-y-6">
              <StepSection
                title="Essentials"
                subtitle="Required before your school can operate day to day."
                steps={evaluation.mandatory}
                nextId={evaluation.nextStep?.tier === "mandatory" ? evaluation.nextStep.id : null}
                onSkipStep={onSkipStep}
                onEnterWorkingMode={onEnterWorkingMode}
              />
              <StepSection
                title="When you are ready"
                subtitle="Recommended — skip any item and return later."
                steps={evaluation.optional}
                nextId={evaluation.nextStep?.tier === "optional" ? evaluation.nextStep.id : null}
                onSkipStep={onSkipStep}
                onEnterWorkingMode={onEnterWorkingMode}
              />
            </div>
          )}

          {phase === "celebration" && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-[0_16px_40px_-12px_rgba(21,101,90,0.65)]">
                <Icon name="check" size={28} className="[&>circle]:hidden" />
              </span>
              <p className="mt-4 text-[13px] font-medium text-slate-700">
                Opening your dashboard…
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {phase !== "celebration" && (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
            {phase === "welcome" ? (
              <Button
                className="w-full"
                variant="accent"
                size="md"
                onClick={() => setPhase("checklist")}
              >
                Begin setup
                <Icon name="arrow-right" size={14} />
              </Button>
            ) : (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-slate-500">
                  {evaluation.totalResolved}/{evaluation.totalApplicable} complete
                  {!mandatoryComplete && " · finish required steps first"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {mandatoryComplete && pendingOptional.length > 0 && (
                    <Button size="sm" variant="secondary" onClick={onSkipAllOptional}>
                      Skip remaining optional
                    </Button>
                  )}
                  {mandatoryComplete && (
                    <Button size="sm" variant="ghost" onClick={onEnterWorkingMode}>
                      Work in background
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function SchoolSetupFloatingReminder({
  evaluation,
  onReopen,
}: {
  evaluation: SetupEvaluation;
  onReopen: () => void;
}) {
  const pct =
    evaluation.totalApplicable > 0
      ? Math.round((evaluation.totalResolved / evaluation.totalApplicable) * 100)
      : 0;

  return (
    <button
      type="button"
      onClick={onReopen}
      className="fixed bottom-5 right-5 z-[90] flex max-w-[min(100vw-2rem,280px)] items-center gap-3 rounded-2xl border border-brand-200/80 bg-white px-3.5 py-3 text-left shadow-[0_16px_48px_-16px_rgba(21,101,90,0.45)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      aria-label="Open setup checklist"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
        <Icon name="check" size={16} className="[&>circle]:hidden opacity-30" />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
          {pct}%
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-slate-900">Setup in progress</span>
        <span className="block truncate text-[10px] text-slate-500">
          {evaluation.nextStep?.title ?? "Almost there"}
        </span>
      </span>
      <Icon name="chevron-up" size={14} className="shrink-0 text-brand-500" />
    </button>
  );
}
