"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { Breadcrumb } from "@/lib/pageMeta";

export interface TopBarPill {
  label: string;
  tone?: "brand" | "slate" | "amber" | "gold";
}

interface TopNavbarProps {
  breadcrumbs: Breadcrumb[];
  title: string;
  userName: string;
  userRole: string;
  pills?: TopBarPill[];
  onMenu?: () => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function pillClass(tone: TopBarPill["tone"]) {
  switch (tone) {
    case "amber":
      return "bg-amber-50 text-amber-800 ring-amber-200/80";
    case "slate":
      return "bg-slate-100 text-slate-700 ring-slate-200/80";
    case "gold":
      return "bg-gold-50 text-gold-700 ring-gold-200/70";
    default:
      return "bg-brand-50 text-brand-800 ring-brand-100";
  }
}

function pillDot(tone: TopBarPill["tone"]) {
  switch (tone) {
    case "amber":
      return "bg-amber-500";
    case "slate":
      return "bg-slate-400";
    case "gold":
      return "bg-gold-400";
    default:
      return "bg-brand-500";
  }
}

export function TopNavbar({
  breadcrumbs,
  title,
  userName,
  userRole,
  pills = [],
  onMenu,
}: TopNavbarProps) {
  return (
    <header className="app-topbar sticky top-0 z-20 shrink-0">
      <div className="flex h-12 items-center gap-3 px-4 sm:gap-4 sm:px-5 lg:px-7">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:hidden"
          >
            <Icon name="menu" size={18} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="hidden items-center gap-1 sm:flex">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 && (
                    <Icon name="chevron-right" size={10} className="shrink-0 text-slate-300" />
                  )}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="truncate text-[11px] font-medium text-slate-500 transition hover:text-slate-800"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "truncate text-[11px]",
                        isLast ? "font-semibold text-slate-900" : "font-medium text-slate-500",
                      )}
                    >
                      {crumb.label}
                    </span>
                  )}
                </Fragment>
              );
            })}
          </nav>
          <p className="truncate text-[13px] font-semibold tracking-tight text-slate-900 sm:hidden">
            {title}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {pills.map((pill) => (
            <span
              key={pill.label}
              className={cn(
                "hidden items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 md:inline-flex",
                pillClass(pill.tone),
              )}
            >
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", pillDot(pill.tone))} />
              {pill.label}
            </span>
          ))}

          {pills.length > 0 && (
            <span aria-hidden className="hidden h-4 w-px bg-slate-200 md:block" />
          )}

          <div
            className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white py-1 pl-1 pr-2.5 shadow-sm"
            title={`${userName} · ${userRole}`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-600 text-[9px] font-bold text-white shadow-sm">
              {initials(userName)}
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="max-w-[140px] truncate text-[11px] font-medium leading-tight text-slate-900">
                {userName}
              </p>
              <p className="max-w-[140px] truncate text-[9px] capitalize leading-tight text-slate-500">
                {userRole}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
