"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { ModulePicker } from "@/components/domain/ModulePicker";
import { SchoolBadgePicker } from "@/components/domain/school/SchoolBadgeUpload";
import { useToast } from "@/components/ui/Toast";
import { parseError, ParsedError } from "@/lib/apiError";
import {
  useDistrictsQuery,
  useEstimateMutation,
  useModuleCatalogQuery,
  useOnboardSchoolMutation,
  useSuggestSchoolCodeQuery,
  useUploadPlatformSchoolBadgeMutation,
} from "@/store/api/skulpulseApi";

const DEFAULT_MODULES = [
  "core",
  "students",
  "teachers",
  "academics",
  "assessment",
  "attendance",
];

export default function OnboardSchoolPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: catalog, isLoading: catalogLoading } = useModuleCatalogQuery();
  const { data: districts } = useDistrictsQuery();
  const [estimate] = useEstimateMutation();
  const [onboard, { isLoading: submitting }] = useOnboardSchoolMutation();
  const [uploadBadge] = useUploadPlatformSchoolBadgeMutation();

  const [baseFee, setBaseFee] = useState(100000);
  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES);
  const [error, setError] = useState<ParsedError | null>(null);
  const [badgeFile, setBadgeFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: "",
    school_code: "",
    ownership: "private",
    district_id: "",
    phone: "",
    email: "",
    head_teacher_name: "",
    emis_number: "",
    status: "trial",
    admin_name: "",
    admin_login_id: "0001",
    admin_password: "",
  });

  const [debouncedName, setDebouncedName] = useState("");
  useEffect(() => {
    const trimmed = form.name.trim();
    const timer = window.setTimeout(() => setDebouncedName(trimmed), 400);
    return () => window.clearTimeout(timer);
  }, [form.name]);

  const { data: codeSuggestion, isFetching: codeLoading } = useSuggestSchoolCodeQuery(
    { name: debouncedName },
    { skip: debouncedName.length < 2 },
  );

  useEffect(() => {
    if (codeSuggestion?.school_code) {
      setForm((f) => ({ ...f, school_code: codeSuggestion.school_code }));
    }
  }, [codeSuggestion?.school_code]);

  const codeHint = useMemo(() => {
    if (debouncedName.length < 2) {
      return "Enter the school name — a unique login code is generated automatically.";
    }
    if (codeLoading) return "Generating code…";
    if (codeSuggestion?.note) return codeSuggestion.note;
    return "Auto-generated from the school name — used in portal logins (e.g. 0001@CODE).";
  }, [codeLoading, codeSuggestion?.note, debouncedName.length]);

  useEffect(() => {
    estimate({ module_keys: ["core"] })
      .unwrap()
      .then((r) => setBaseFee(r.platform_base_fee_ugx))
      .catch(() => undefined);
  }, [estimate]);

  const fieldErrors = error?.fieldErrors ?? {};
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const codePreview = useMemo(
    () => (form.school_code ? `${form.admin_login_id}@${form.school_code.toUpperCase()}` : ""),
    [form.school_code, form.admin_login_id],
  );

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length >= 2 &&
      /^[A-Z0-9]{4,8}$/.test(form.school_code.trim()) &&
      !codeLoading &&
      form.email.trim().length > 0 &&
      form.admin_name.trim().length >= 2 &&
      form.admin_password.length >= 8
    );
  }, [form, codeLoading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    const email = form.email.trim();
    const payload = {
      name: form.name,
      school_code: form.school_code,
      ownership: form.ownership,
      district_id: form.district_id || null,
      phone: form.phone || null,
      email,
      head_teacher_name: form.head_teacher_name || null,
      emis_number: form.emis_number || null,
      status: form.status,
      module_keys: modules,
      admin_user: {
        name: form.admin_name,
        login_id: form.admin_login_id,
        password: form.admin_password,
      },
    };
    try {
      const res = (await onboard(payload).unwrap()) as { tenant_id: string };
      if (badgeFile) {
        await uploadBadge({ tenantId: res.tenant_id, file: badgeFile }).unwrap();
      }
      toast("School onboarded successfully.", "success");
      router.push(`/admin/schools/${res.tenant_id}`);
    } catch (err) {
      const parsed = parseError(err);
      setError(parsed);
      toast(parsed.message, "error", parsed.requestId);
    }
  }

  if (catalogLoading || !catalog) return <PageLoader />;

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Onboard school"
        description="Create a tenant, profile, admin and module subscriptions."
      />
      {error && !Object.keys(fieldErrors).length && (
        <div className="mb-4">
          <ErrorBanner message={error.message} requestId={error.requestId} />
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="School identity" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <FormField label="School name" required error={fieldErrors["name"]}>
                <Input value={form.name} onChange={set("name")} required invalid={!!fieldErrors["name"]} />
              </FormField>
              <FormField
                label="School code"
                hint={codeHint}
                required
                error={fieldErrors["school_code"]}
              >
                <Input
                  value={form.school_code}
                  readOnly
                  className="bg-slate-50 uppercase tracking-wide"
                  invalid={!!fieldErrors["school_code"]}
                />
              </FormField>
              <FormField label="Ownership">
                <Select value={form.ownership} onChange={set("ownership")}>
                  <option value="private">Private</option>
                  <option value="government">Government</option>
                  <option value="government_aided">Government aided</option>
                </Select>
              </FormField>
              <FormField label="District">
                <Select value={form.district_id} onChange={set("district_id")}>
                  <option value="">Select district…</option>
                  {districts?.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </FormField>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="School badge" description="Crest or logo for the portal and report cards." />
            <CardBody>
              <SchoolBadgePicker
                schoolName={form.name || "School"}
                file={badgeFile}
                onChange={setBadgeFile}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact & EMIS" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <FormField label="Phone" error={fieldErrors["phone"]}>
                <Input value={form.phone} onChange={set("phone")} placeholder="+256…" />
              </FormField>
              <FormField
                label="School email"
                hint="Portal credentials are emailed here — must be unique per school"
                required
                error={fieldErrors["email"]}
              >
                <Input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  required
                  invalid={!!fieldErrors["email"]}
                />
              </FormField>
              <FormField label="Head teacher">
                <Input value={form.head_teacher_name} onChange={set("head_teacher_name")} />
              </FormField>
              <FormField label="EMIS number" hint="Optional until registered">
                <Input value={form.emis_number} onChange={set("emis_number")} />
              </FormField>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Admin account" description="The first school administrator (login 0001)." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <FormField label="Admin name" required error={fieldErrors["admin_user.name"]}>
                <Input value={form.admin_name} onChange={set("admin_name")} required invalid={!!fieldErrors["admin_user.name"]} />
              </FormField>
              <FormField label="Login ID">
                <Input value={form.admin_login_id} onChange={set("admin_login_id")} />
              </FormField>
              <FormField
                label="Password"
                hint="Minimum 8 characters"
                required
                error={fieldErrors["admin_user.password"]}
              >
                <Input
                  type="password"
                  value={form.admin_password}
                  onChange={set("admin_password")}
                  required
                  invalid={!!fieldErrors["admin_user.password"]}
                />
              </FormField>
              <FormField label="Username preview">
                <Input value={codePreview} readOnly className="bg-slate-50" />
              </FormField>
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Modules" description="Subscribed per term." />
            <CardBody>
              <ModulePicker
                catalog={catalog}
                selected={modules}
                onChange={setModules}
                baseFeeUgx={baseFee}
              />
            </CardBody>
          </Card>
          <Button type="submit" loading={submitting} disabled={!canSubmit} className="w-full">
            Onboard school
          </Button>
        </div>
      </form>
    </div>
  );
}
