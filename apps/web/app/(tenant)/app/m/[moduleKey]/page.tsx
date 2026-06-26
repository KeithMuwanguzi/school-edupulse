"use client";

import { useParams } from "next/navigation";
import { ComingSoonPanel } from "@/components/domain/ComingSoonPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { moduleIcon, moduleLabel } from "@/lib/moduleMeta";
import { useAppSelector } from "@/store/hooks";

export default function ModulePlaceholderPage() {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const user = useAppSelector((s) => s.auth.user);

  const subscribed = user?.modules.includes(moduleKey);
  const label = moduleLabel(moduleKey);

  return (
    <div className="space-y-4 animate-fade-rise">
      <PageHeader eyebrow="Module" title={label} />
      {subscribed ? (
        <ComingSoonPanel
          title={label}
          icon={<Icon name={moduleIcon(moduleKey)} size={18} />}
          description={`The ${label} module is enabled for your school and will be implemented soon. Contact SkulPulse if you need this feature prioritised.`}
        />
      ) : (
        <EmptyState
          icon={<Icon name="grid" size={18} />}
          title="Not subscribed"
          description="This module is not part of your current subscription. Ask your school administrator to review modules under Settings."
        />
      )}
    </div>
  );
}
