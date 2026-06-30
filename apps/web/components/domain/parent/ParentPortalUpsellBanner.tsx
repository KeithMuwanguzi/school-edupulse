"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PARENT_PORTAL_UPSELL } from "@/lib/parentPortal";

export function ParentPortalUpsellBanner({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-[11px] text-amber-950"
          : "rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-[11.5px] text-amber-950"
      }
    >
      <p className="flex items-start gap-2">
        <Icon name="spark" size={14} className="mt-0.5 shrink-0 text-amber-600" />
        <span>
          {PARENT_PORTAL_UPSELL}{" "}
          <Link
            href="/app/settings/modules"
            className="font-semibold text-amber-900 underline decoration-amber-400/60 underline-offset-2 hover:text-amber-950"
          >
            View modules
          </Link>
        </span>
      </p>
    </div>
  );
}
