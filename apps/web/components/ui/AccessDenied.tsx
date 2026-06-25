import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";

interface AccessDeniedProps {
  title?: string;
  description?: string;
  showDashboardLink?: boolean;
}

/** Friendly gate when the user's role cannot view a section (replaces raw API 403 banners). */
export function AccessDenied({
  title = "You don't have access",
  description = "Your role doesn't include permission to view this section. Contact your school administrator if you need access.",
  showDashboardLink = true,
}: AccessDeniedProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      icon={<Icon name="shield" size={20} />}
      action={
        showDashboardLink ? (
          <Link href="/app">
            <Button size="sm" variant="secondary">
              Back to dashboard
            </Button>
          </Link>
        ) : undefined
      }
    />
  );
}
