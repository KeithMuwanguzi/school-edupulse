"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function RosterExportButton({
  disabled,
  onExport,
}: {
  disabled?: boolean;
  onExport: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      size="sm"
      variant="ghost"
      loading={loading}
      disabled={disabled || loading}
      onClick={() => {
        setLoading(true);
        void onExport().finally(() => setLoading(false));
      }}
    >
      <Icon name="arrow-down" size={13} />
      Export Excel
    </Button>
  );
}
