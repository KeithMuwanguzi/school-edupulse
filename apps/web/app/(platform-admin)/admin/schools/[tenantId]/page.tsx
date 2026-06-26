"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PageLoader } from "@/components/ui/Spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { ModulePicker } from "@/components/domain/ModulePicker";
import { SchoolBadgeUpload } from "@/components/domain/school/SchoolBadgeUpload";
import { useToast } from "@/components/ui/Toast";
import { useConfirm, useRevealSecret } from "@/components/ui/Dialog";
import { parseError } from "@/lib/apiError";
import {
  useEstimateMutation,
  useGetSchoolQuery,
  useListSchoolUsersQuery,
  useModuleCatalogQuery,
  useReplaceModulesMutation,
  useResetPlatformAdminCredentialsMutation,
  useResetPlatformUserPasswordMutation,
  useUpdateSchoolMutation,
  useUploadPlatformSchoolBadgeMutation,
  useDeletePlatformSchoolBadgeMutation,
} from "@/store/api/skulpulseApi";

export default function SchoolDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { toast } = useToast();
  const confirm = useConfirm();
  const revealSecret = useRevealSecret();
  const { data, isLoading, isError, error } = useGetSchoolQuery(tenantId);
  const { data: catalog } = useModuleCatalogQuery();
  const { data: users } = useListSchoolUsersQuery(tenantId);
  const [estimate] = useEstimateMutation();
  const [updateSchool, { isLoading: savingProfile }] = useUpdateSchoolMutation();
  const [replaceModules, { isLoading: savingModules }] = useReplaceModulesMutation();
  const [uploadBadge, { isLoading: uploadingBadge }] = useUploadPlatformSchoolBadgeMutation();
  const [deleteBadge, { isLoading: removingBadge }] = useDeletePlatformSchoolBadgeMutation();
  const [resetAdminCreds, { isLoading: resettingAdmin }] = useResetPlatformAdminCredentialsMutation();
  const [resetUserPassword, { isLoading: resettingUser }] = useResetPlatformUserPasswordMutation();

  const [baseFee, setBaseFee] = useState(100000);
  const [modules, setModules] = useState<string[]>([]);
  const [profile, setProfile] = useState({
    name: "",
    motto: "",
    head_teacher_name: "",
    phone: "",
    email: "",
    ownership: "private",
    status: "trial",
  });

  useEffect(() => {
    estimate({ module_keys: ["core"] }).unwrap().then((r) => setBaseFee(r.platform_base_fee_ugx)).catch(() => undefined);
  }, [estimate]);

  useEffect(() => {
    if (!data) return;
    setModules(data.modules);
    setProfile({
      name: data.profile.name,
      motto: data.profile.motto ?? "",
      head_teacher_name: data.profile.head_teacher_name ?? "",
      phone: data.profile.phone ?? "",
      email: data.profile.email ?? "",
      ownership: data.profile.ownership,
      status: data.status,
    });
  }, [data]);

  if (isLoading) return <PageLoader />;
  if (isError || !data) return <ErrorBanner message={parseError(error).message} />;

  async function saveProfile() {
    if (!profile.email.trim()) {
      toast("School email is required.", "error");
      return;
    }
    try {
      await updateSchool({
        tenantId,
        body: {
          name: profile.name,
          motto: profile.motto || null,
          head_teacher_name: profile.head_teacher_name || null,
          phone: profile.phone || null,
          email: profile.email.trim(),
          ownership: profile.ownership,
          status: profile.status,
          version: data!.profile.version,
        },
      }).unwrap();
      toast("Profile saved.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function saveModules() {
    try {
      await replaceModules({ tenantId, module_keys: modules }).unwrap();
      toast("Modules updated.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function emailAdminCredentials() {
    const ok = await confirm({
      title: "Reset administrator credentials",
      description: "Generate a new administrator password and email it to the school contact?",
      confirmLabel: "Send credentials",
    });
    if (!ok) return;
    try {
      const result = await resetAdminCreds(tenantId).unwrap();
      if (result.email_sent && result.email_recipient) {
        toast(`Credentials emailed to ${result.email_recipient}.`, "success");
      } else if (result.temporary_password) {
        toast(result.message, "warning");
        await revealSecret({
          title: "Temporary admin password",
          description: "Email could not be sent. Copy this password and share it securely.",
          secret: result.temporary_password,
          secretLabel: "Admin password",
        });
      } else {
        toast(result.message, "success");
      }
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function resetPortalUser(userId: string, username: string) {
    const ok = await confirm({
      title: "Reset password",
      description: `Generate a temporary password for ${username}?`,
      confirmLabel: "Reset password",
    });
    if (!ok) return;
    try {
      const result = await resetUserPassword({ tenantId, userId }).unwrap();
      if (result.email_sent && result.email_recipient) {
        toast(`Password emailed to ${result.email_recipient}.`, "success");
      } else if (result.temporary_password) {
        toast(result.message, "success");
        await revealSecret({
          title: "Temporary password",
          description: "Copy this password now. It will not be shown again.",
          secret: result.temporary_password,
        });
      } else {
        toast(result.message, "success");
      }
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div>
      <Link
        href="/admin"
        className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-wide text-brand-700 hover:underline"
      >
        ← Schools
      </Link>
      <PageHeader
        eyebrow="School detail"
        title={data.profile.name}
        description={`${data.school_code} · created ${new Date(data.created_at).toLocaleDateString()}`}
        action={<StatusBadge status={data.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="School badge" description="Shown on the school portal and report cards." />
            <CardBody>
              <SchoolBadgeUpload
                schoolName={data.profile.name}
                badgeUrl={data.profile.badge_url}
                uploading={uploadingBadge}
                removing={removingBadge}
                onUpload={async (file) => {
                  await uploadBadge({ tenantId, file }).unwrap();
                  toast("Badge updated.", "success");
                }}
                onRemove={async () => {
                  await deleteBadge(tenantId).unwrap();
                  toast("Badge removed.", "success");
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Profile" action={<Button size="sm" loading={savingProfile} onClick={saveProfile}>Save</Button>} />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <FormField label="School name">
                <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
              </FormField>
              <FormField label="Motto">
                <Input value={profile.motto} onChange={(e) => setProfile((p) => ({ ...p, motto: e.target.value }))} />
              </FormField>
              <FormField label="Head teacher">
                <Input value={profile.head_teacher_name} onChange={(e) => setProfile((p) => ({ ...p, head_teacher_name: e.target.value }))} />
              </FormField>
              <FormField label="Phone">
                <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
              </FormField>
              <FormField label="School email" hint="Required — credentials and resets are sent here" required>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Ownership">
                <Select value={profile.ownership} onChange={(e) => setProfile((p) => ({ ...p, ownership: e.target.value }))}>
                  <option value="private">Private</option>
                  <option value="government">Government</option>
                  <option value="government_aided">Government aided</option>
                </Select>
              </FormField>
              <FormField label="Status">
                <Select value={profile.status} onChange={(e) => setProfile((p) => ({ ...p, status: e.target.value }))}>
                  <option value="trial">Trial</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </FormField>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Portal accounts"
              action={
                <Button size="sm" variant="secondary" loading={resettingAdmin} onClick={() => void emailAdminCredentials()}>
                  Email admin credentials
                </Button>
              }
            />
            <CardBody className="p-0">
              <Table>
                <THead>
                  <TR><TH>Name</TH><TH>Username</TH><TH>Role</TH><TH>Status</TH><TH></TH></TR>
                </THead>
                <TBody>
                  {users?.map((u) => (
                    <TR key={u.id}>
                      <TD className="font-medium text-slate-900">{u.name}</TD>
                      <TD><code className="text-xs">{u.username}</code></TD>
                      <TD className="capitalize">{u.role.replace("_", " ")}</TD>
                      <TD>{u.status}</TD>
                      <TD className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={resettingUser}
                          onClick={() => void resetPortalUser(u.id, u.username)}
                        >
                          Reset
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Modules" action={<Button size="sm" loading={savingModules} onClick={saveModules}>Save</Button>} />
            <CardBody>
              {catalog && (
                <ModulePicker catalog={catalog} selected={modules} onChange={setModules} baseFeeUgx={baseFee} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
