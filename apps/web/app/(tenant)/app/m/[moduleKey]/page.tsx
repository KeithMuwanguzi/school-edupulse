"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ComingSoonPanel } from "@/components/domain/ComingSoonPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { moduleIcon, moduleLabel } from "@/lib/moduleMeta";
import { roleCanAccessModule } from "@/lib/roleAccess";
import { useAppSelector } from "@/store/hooks";

export default function ModulePlaceholderPage() {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);

  useEffect(() => {
    if (user?.role === "parent" && !roleCanAccessModule(user.role, moduleKey)) {
      router.replace("/app");
    }
  }, [moduleKey, router, user?.role]);

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
