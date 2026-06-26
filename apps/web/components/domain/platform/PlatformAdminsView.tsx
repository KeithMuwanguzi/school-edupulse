"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { RefreshButton } from "@/components/ui/RefreshButton";
import { SkeletonRows, Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useConfirm, useRevealSecret } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { parseError } from "@/lib/apiError";
import type { PlatformAdminOut } from "@/lib/types";
import {
  useCreatePlatformAdminMutation,
  useDeletePlatformAdminMutation,
  useGetMeQuery,
  useListPlatformAdminsQuery,
  useResetPlatformAdminPasswordMutation,
  useUpdatePlatformAdminMutation,
} from "@/store/api/skulpulseApi";

function AdminRow({
  admin,
  isSelf,
}: {
  admin: PlatformAdminOut;
  isSelf: boolean;
}) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const revealSecret = useRevealSecret();
  const [updateAdmin, { isLoading: saving }] = useUpdatePlatformAdminMutation();
  const [resetPassword, { isLoading: resetting }] = useResetPlatformAdminPasswordMutation();
  const [deleteAdmin, { isLoading: deleting }] = useDeletePlatformAdminMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(admin.name);
  const [email, setEmail] = useState(admin.email);

  async function save() {
    try {
      await updateAdmin({
        adminId: admin.id,
        body: { name: name.trim(), email: email.trim() },
      }).unwrap();
      toast("Saved.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function toggleActive() {
    const next = !admin.is_active;
    const ok = await confirm({
      title: next ? "Re-enable administrator" : "Deactivate administrator",
      description: next
        ? `Allow ${admin.email} to sign in again?`
        : `${admin.email} will be signed out and cannot sign in until re-enabled.`,
      confirmLabel: next ? "Re-enable" : "Deactivate",
      tone: next ? "default" : "danger",
    });
    if (!ok) return;
    try {
      await updateAdmin({ adminId: admin.id, body: { is_active: next } }).unwrap();
      toast(next ? "Re-enabled." : "Deactivated.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Delete administrator",
      description: `Permanently remove ${admin.email}? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteAdmin(admin.id).unwrap();
      toast("Administrator deleted.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function resetPass() {
    const ok = await confirm({
      title: "Reset password",
      description: `Generate a temporary password for ${admin.email}?`,
      confirmLabel: "Reset password",
    });
    if (!ok) return;
    try {
      const result = await resetPassword(admin.id).unwrap();
      if (result.email_sent && result.email_recipient) {
        toast(`Temporary password emailed to ${result.email_recipient}.`, "success");
      } else if (result.temporary_password) {
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

  if (editing) {
    return (
      <TR>
        <TD colSpan={5}>
          <div className="flex flex-wrap items-end gap-2 py-1">
            <div className="min-w-[10rem] flex-1">
              <FormField label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
            </div>
            <div className="min-w-[12rem] flex-1">
              <FormField label="Email">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </FormField>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </TD>
      </TR>
    );
  }

  return (
    <TR>
      <TD className="text-[12px] font-medium text-slate-800">{admin.name}</TD>
      <TD className="font-mono text-[11px] text-slate-600">{admin.email}</TD>
      <TD>
        {admin.is_active ? (
          <Badge tone="green">Active</Badge>
        ) : (
          <Badge tone="amber">Inactive</Badge>
        )}
      </TD>
      <TD className="text-[11px] text-slate-500">
        {admin.last_login_at
          ? new Date(admin.last_login_at).toLocaleString()
          : "Never"}
      </TD>
      <TD className="text-right">
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {!isSelf && (
            <Button size="sm" variant="ghost" loading={resetting} onClick={() => void resetPass()}>
              Reset password
            </Button>
          )}
          {!isSelf && (
            <Button size="sm" variant="ghost" onClick={() => void toggleActive()}>
              {admin.is_active ? "Deactivate" : "Re-enable"}
            </Button>
          )}
          {!isSelf && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              loading={deleting}
              onClick={() => void remove()}
            >
              Delete
            </Button>
          )}
        </div>
      </TD>
    </TR>
  );
}

export function PlatformAdminsView() {
  const { toast } = useToast();
  const { data: me } = useGetMeQuery();
  const { data: admins = [], isFetching, refetch } = useListPlatformAdminsQuery();
  const [createAdmin, { isLoading: creating }] = useCreatePlatformAdminMutation();
  const revealSecret = useRevealSecret();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notify, setNotify] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await createAdmin({
        name: name.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
        notify,
      }).unwrap();
      if (result.email_sent && result.email_recipient) {
        toast(`Credentials emailed to ${result.email_recipient}.`, "success");
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
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Administrators"
        description="Manage SkulPulse platform console users. Credentials can be emailed on create or password reset."
      />

      <Card className="p-4">
        <h2 className="text-[13px] font-semibold text-slate-800">Add administrator</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => void submit(e)}>
          <FormField label="Full name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Email" required>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </FormField>
          <FormField label="Temporary password" hint="Leave blank to auto-generate">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={8}
              autoComplete="new-password"
            />
          </FormField>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 pb-2 text-[12px] text-slate-600">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="rounded border-slate-300"
              />
              Email credentials
            </label>
            <Button type="submit" loading={creating} className="ml-auto">
              Create
            </Button>
          </div>
        </form>
      </Card>

      <PageToolbar>
        <RefreshButton onRefresh={() => refetch()} isRefreshing={isFetching} label="Refresh" />
      </PageToolbar>

      {isFetching && admins.length === 0 ? (
        <Table>
          <TBody>
            <SkeletonRows cols={5} />
          </TBody>
        </Table>
      ) : admins.length === 0 ? (
        <EmptyState
          icon={<Icon name="users" size={18} />}
          title="No administrators"
          description="Create the first platform administrator above."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Status</TH>
              <TH>Last sign-in</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {admins.map((admin) => (
              <AdminRow key={admin.id} admin={admin} isSelf={admin.id === me?.id} />
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
