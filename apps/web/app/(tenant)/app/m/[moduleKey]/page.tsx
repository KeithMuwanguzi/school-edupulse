"use client";

import { useParams } from "next/navigation";
import { ComingSoonPanel } from "@/components/domain/ComingSoonPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { moduleLabel } from "@/lib/moduleMeta";
import { useAppSelector } from "@/store/hooks";

export default function ModulePlaceholderPage() {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const user = useAppSelector((s) => s.auth.user);

  const subscribed = user?.modules.includes(moduleKey);
  const label = moduleLabel(moduleKey);

  return (
    <div>
      <PageHeader eyebrow="Module" title={label} />
      {subscribed ? (
        <ComingSoonPanel
          title={label}
          description={`The ${label} module is enabled for your school and will be implemented soon.`}
        />
      ) : (
        <EmptyState
          title="Not subscribed"
          description="This module is not part of your current subscription."
        />
      )}
    </div>
  );
}
