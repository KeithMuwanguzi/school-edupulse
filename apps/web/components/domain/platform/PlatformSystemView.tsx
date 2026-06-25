"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { parseError } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useResetPlatformDataMutation } from "@/store/api/skulpulseApi";

const CONFIRMATION_PHRASE = "RESET ALL DATA";

export function PlatformSystemView() {
  const toast = useToast();
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [resetData, { isLoading, isError, error }] = useResetPlatformDataMutation();

  const canSubmit =
    acknowledged && confirmation === CONFIRMATION_PHRASE && !isLoading;

  async function handleReset() {
    if (!canSubmit) return;
    if (
      !window.confirm(
        "This permanently deletes all schools, learners, logs, and uploads. Your platform admin login is kept. Continue?",
      )
    ) {
      return;
    }

    try {
      const result = await resetData({ confirmation: CONFIRMATION_PHRASE }).unwrap();
      toast.success(
        `Data reset complete. ${result.tables_truncated} tables cleared. Platform admin preserved.`,
      );
      setConfirmation("");
      setAcknowledged(false);
    } catch (e) {
      toast.error(parseError(e).message);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="System"
        description="Maintenance tools for the SkulPulse platform operator."
      />

      {isError && <ErrorBanner message={parseError(error).message} className="mb-4" />}

      <Card className="border-red-200/80">
        <CardHeader
          title="Reset all data"
          description="Wipe every school, user, learner record, log, and uploaded badge. Module catalogue, districts, and your platform admin password stay unchanged."
        />
        <CardBody className="space-y-4">
          <p className="text-[12px] leading-relaxed text-slate-600">
            Use this while testing before go-live. After you onboard real schools, turn off{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
              PLATFORM_ALLOW_DATA_RESET
            </code>{" "}
            on the server so this button stops working.
          </p>

          <label className="flex cursor-pointer items-start gap-2 text-[12px] text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              I understand this cannot be undone and will remove all onboarded schools and
              operational data.
            </span>
          </label>

          <FormField
            label={`Type ${CONFIRMATION_PHRASE} to confirm`}
            htmlFor="reset-confirmation"
          >
            <Input
              id="reset-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              autoComplete="off"
            />
          </FormField>

          <div>
            <Button variant="danger" loading={isLoading} disabled={!canSubmit} onClick={handleReset}>
              Reset all data
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
