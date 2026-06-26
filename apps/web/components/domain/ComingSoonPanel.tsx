import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";

interface ComingSoonPanelProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

/** Placeholder for settings and module screens not yet built. */
export function ComingSoonPanel({ title, description, icon }: ComingSoonPanelProps) {
  return (
    <EmptyState
      icon={icon}
      title={`${title} — coming soon`}
      description={
        description ??
        `${title} will be implemented in a later phase. Your school can prepare the data model now — functionality arrives soon.`
      }
    />
  );
}
