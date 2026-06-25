"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import { useGetTenantSchoolQuery, useUpdateTenantSchoolMutation, useUploadTenantSchoolBadgeMutation, useDeleteTenantSchoolBadgeMutation } from "@/store/api/skulpulseApi";
import { SchoolBadgeUpload } from "@/components/domain/school/SchoolBadgeUpload";

const EMPTY = {
  name: "",
  motto: "",
  head_teacher_name: "",
  phone: "",
  student_number_prefix: "",
  report_footer_notes: "",
  report_next_term_note: "",
};

export default function SettingsProfilePage() {
  const { toast } = useToast();
  const { data: school, isLoading } = useGetTenantSchoolQuery();
  const [updateSchool, { isLoading: savingProfile }] = useUpdateTenantSchoolMutation();
  const [uploadBadge, { isLoading: uploadingBadge }] = useUploadTenantSchoolBadgeMutation();
  const [deleteBadge, { isLoading: removingBadge }] = useDeleteTenantSchoolBadgeMutation();
  const [profile, setProfile] = useState(EMPTY);

  useEffect(() => {
    if (school) {
      setProfile({
        name: school.profile.name,
        motto: school.profile.motto ?? "",
        head_teacher_name: school.profile.head_teacher_name ?? "",
        phone: school.profile.phone ?? "",
        student_number_prefix: school.profile.student_number_prefix ?? "",
        report_footer_notes: school.profile.report_footer_notes ?? "",
        report_next_term_note: school.profile.report_next_term_note ?? "",
      });
    }
  }, [school]);

  const dirty = useMemo(() => {
    if (!school) return false;
    return (
      profile.name !== school.profile.name ||
      profile.motto !== (school.profile.motto ?? "") ||
      profile.head_teacher_name !== (school.profile.head_teacher_name ?? "") ||
      profile.phone !== (school.profile.phone ?? "") ||
      profile.student_number_prefix !== (school.profile.student_number_prefix ?? "") ||
      profile.report_footer_notes !== (school.profile.report_footer_notes ?? "") ||
      profile.report_next_term_note !== (school.profile.report_next_term_note ?? "")
    );
  }, [profile, school]);

  if (isLoading || !school) return <PageLoader />;

  async function saveProfile() {
    try {
      await updateSchool({
        name: profile.name,
        motto: profile.motto || null,
        head_teacher_name: profile.head_teacher_name || null,
        phone: profile.phone || null,
        student_number_prefix: profile.student_number_prefix.trim() || undefined,
        report_footer_notes: profile.report_footer_notes.trim() || null,
        report_next_term_note: profile.report_next_term_note.trim() || null,
        version: school!.profile.version,
      }).unwrap();
      toast("Profile saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader
            icon={<Icon name="spark" size={13} />}
            title="School badge"
            description="Your crest on the portal sidebar and printed report cards."
          />
          <CardBody>
            <SchoolBadgeUpload
              schoolName={school.profile.name}
              badgeUrl={school.profile.badge_url}
              uploading={uploadingBadge}
              removing={removingBadge}
              onUpload={async (file) => {
                await uploadBadge(file).unwrap();
                toast("Badge updated.", "success");
              }}
              onRemove={async () => {
                await deleteBadge().unwrap();
                toast("Badge removed.", "success");
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Icon name="building2" size={13} />}
            title="Identity"
            description="Name and motto shown across the portal."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="School name">
              <Input
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Kampala Junior School"
              />
            </FormField>
            <FormField label="Motto">
              <Input
                value={profile.motto}
                onChange={(e) => setProfile((p) => ({ ...p, motto: e.target.value }))}
                placeholder="e.g. Knowledge is light"
              />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Icon name="user" size={13} />}
            title="Leadership & contact"
            description="How families and staff reach the school office."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <FormField label="Head teacher">
              <Input
                value={profile.head_teacher_name}
                onChange={(e) => setProfile((p) => ({ ...p, head_teacher_name: e.target.value }))}
                placeholder="Full name"
              />
            </FormField>
            <FormField label="Phone">
              <Input
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                placeholder="e.g. +256 7XX XXX XXX"
              />
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Icon name="hash" size={13} />}
            title="Student numbering"
            description="Student numbers are assigned automatically using this prefix plus a running sequence."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Number prefix"
              hint="2–8 digits. Assigned automatically on first enrollment; edit to match your scheme."
            >
              <Input
                value={profile.student_number_prefix}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    student_number_prefix: e.target.value.replace(/\D/g, "").slice(0, 8),
                  }))
                }
                placeholder="Auto-assigned"
                inputMode="numeric"
                className="font-mono"
              />
            </FormField>
            <FormField label="Example number">
              <div className="flex h-9 items-center rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 font-mono text-[13px] text-slate-600">
                {(profile.student_number_prefix || "10XX") + "00001"}
              </div>
            </FormField>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Icon name="clipboard" size={13} />}
            title="Report cards"
            description="Footer notes printed on every report card alongside the next term and fee summary."
          />
          <CardBody className="grid gap-4">
            <FormField
              label="Next term note"
              hint="Optional override shown on report cards (e.g. reporting date)."
            >
              <Input
                value={profile.report_next_term_note}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, report_next_term_note: e.target.value }))
                }
                placeholder="e.g. Next term begins Monday 3 February"
                maxLength={255}
              />
            </FormField>
            <FormField
              label="Requirements & fees note"
              hint="Books, uniform, or other requirements. Term fees are added automatically when a fee structure exists."
            >
              <textarea
                value={profile.report_footer_notes}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, report_footer_notes: e.target.value }))
                }
                rows={4}
                placeholder="e.g. Pupils must report with all exercise books and full uniform."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </FormField>
          </CardBody>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <span
            className={cnDirty(dirty)}
          >
            {dirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <Button loading={savingProfile} disabled={!dirty} onClick={saveProfile}>
            Save changes
          </Button>
        </div>
      </div>

      {/* Live identity preview */}
      <div className="lg:col-span-1">
        <Card className="sticky top-2 overflow-hidden">
          <div className="relative bg-brand-700 px-4 py-5 text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(360px 180px at 90% -20%, rgba(229,166,39,0.25) 0%, transparent 60%)",
              }}
            />
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 font-display text-[18px] font-semibold ring-1 ring-white/20">
                {(profile.name || "S").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-medium leading-tight">
                  {profile.name || "Your school"}
                </p>
                {profile.motto ? (
                  <p className="mt-0.5 truncate text-[11px] italic text-brand-100">
                    “{profile.motto}”
                  </p>
                ) : (
                  <p className="mt-0.5 truncate text-[11px] text-brand-200/70">No motto set</p>
                )}
              </div>
            </div>
          </div>
          <CardBody className="space-y-2.5">
            <PreviewRow icon="user" label="Head teacher" value={profile.head_teacher_name} />
            <PreviewRow icon="chat" label="Phone" value={profile.phone} />
            <PreviewRow icon="building" label="School code" value={school.school_code} mono />
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">Status</span>
              <Badge tone="green" dot>
                {school.status}
              </Badge>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function cnDirty(dirty: boolean): string {
  return dirty
    ? "text-[11px] font-medium text-gold-700"
    : "text-[11px] text-slate-400";
}

function PreviewRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[11px] text-slate-500">
        <Icon name={icon} size={13} className="text-slate-400" />
        {label}
      </span>
      <span
        className={
          value
            ? `truncate text-[11.5px] font-medium text-slate-800 ${mono ? "font-mono" : ""}`
            : "text-[11.5px] text-slate-300"
        }
      >
        {value || "Not set"}
      </span>
    </div>
  );
}
