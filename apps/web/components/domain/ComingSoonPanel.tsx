import { EmptyState } from "@/components/ui/EmptyState";

interface ComingSoonPanelProps {
  title: string;
  description?: string;
}

/** Placeholder for settings and module screens not yet built. */
export function ComingSoonPanel({ title, description }: ComingSoonPanelProps) {
  return (
    <EmptyState
      title="Coming soon"
      description={
        description ??
        `${title} will be implemented in a later phase. Your school can prepare the data model now — functionality arrives soon.`
      }
    />
  );
}
