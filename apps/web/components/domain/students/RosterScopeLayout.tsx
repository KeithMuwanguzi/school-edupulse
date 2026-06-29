"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/** Side-by-side roster navigator + main content on large screens; stacked on mobile. */
export function RosterScopeLayout({
  picker,
  children,
}: {
  picker: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Card className="p-3 lg:sticky lg:top-2 lg:w-52 lg:shrink-0 lg:p-1.5 lg:max-h-[min(70vh,calc(100vh-10rem))] lg:overflow-y-auto">
        {picker}
      </Card>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
