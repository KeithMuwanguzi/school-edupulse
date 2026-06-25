"use client";

import { useState } from "react";
import { SettingsFilterPills, SettingsHint } from "@/components/layout/settingsUi";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ImportGuardiansPanel, ImportTeachersPanel } from "./ImportPanels";
import { UserAddPanel } from "./UserForms";

export type AddUserMode = "single" | "import-staff" | "import-guardians";

const ADD_MODES: { id: AddUserMode; label: string }[] = [
  { id: "single", label: "One account" },
  { id: "import-staff", label: "Import staff" },
  { id: "import-guardians", label: "Import guardians" },
];

const MODE_HINTS: Record<AddUserMode, string> = {
  single: "Set a temporary password and share it securely with the account holder.",
  "import-staff": "Paste CSV or upload a file. Columns: login_id, name, email, role_key.",
  "import-guardians":
    "Guardian usernames use the learner’s student number — one portal account per child.",
};

interface UserAddSectionProps {
  schoolCode: string;
  onBack: () => void;
}

export function UserAddSection({ schoolCode, onBack }: UserAddSectionProps) {
  const [mode, setMode] = useState<AddUserMode>("single");

  return (
    <Card>
      <CardHeader
        title="Add users"
        description="Create a single account or import many from CSV."
        action={
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] text-slate-400 hover:text-slate-600"
          >
            ← Back to directory
          </button>
        }
      />
      <CardBody className="space-y-3">
        <SettingsFilterPills
          options={ADD_MODES}
          active={mode}
          onChange={(id) => setMode(id as AddUserMode)}
        />
        <SettingsHint>{MODE_HINTS[mode]}</SettingsHint>
        {mode === "single" && <UserAddPanel schoolCode={schoolCode} />}
        {mode === "import-staff" && <ImportTeachersPanel schoolCode={schoolCode} />}
        {mode === "import-guardians" && <ImportGuardiansPanel schoolCode={schoolCode} />}
      </CardBody>
    </Card>
  );
}
