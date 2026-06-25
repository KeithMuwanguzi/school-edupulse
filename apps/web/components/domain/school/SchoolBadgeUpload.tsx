"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SchoolBadge } from "@/components/domain/school/SchoolBadge";
import { parseError } from "@/lib/apiError";

interface SchoolBadgeUploadProps {
  schoolName: string;
  badgeUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  uploading?: boolean;
  removing?: boolean;
  hint?: string;
}

export function SchoolBadgeUpload({
  schoolName,
  badgeUrl,
  onUpload,
  onRemove,
  uploading,
  removing,
  hint = "PNG, JPEG, or WebP — max 512 KB. Shown on the portal sidebar and report cards.",
}: SchoolBadgeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(parseError(err).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <SchoolBadge name={schoolName} badgeUrl={badgeUrl} size="xl" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {badgeUrl ? "Replace badge" : "Upload badge"}
          </Button>
          {badgeUrl && onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={removing}
              onClick={() => {
                setError(null);
                void onRemove().catch((err) => setError(parseError(err).message));
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-slate-500">{hint}</p>
      {error ? <ErrorBanner message={error} /> : null}
    </div>
  );
}

/** Selected file before a tenant exists — used during onboarding. */
export function SchoolBadgePicker({
  schoolName,
  file,
  onChange,
}: {
  schoolName: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Badge preview"
            className="h-20 w-20 shrink-0 rounded-2xl object-contain bg-white ring-1 ring-slate-200/80"
          />
        ) : (
          <SchoolBadge name={schoolName || "School"} size="xl" />
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {file ? "Change badge" : "Choose badge"}
          </Button>
          {file ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Optional. Uploaded after the school is created — appears on the portal and report cards.
      </p>
    </div>
  );
}
