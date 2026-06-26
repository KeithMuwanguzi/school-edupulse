"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { parseError } from "@/lib/apiError";
import type { PortalUser } from "@/lib/types";
import {
  useListTenantRolesQuery,
  useResetTenantUserPasswordMutation,
  useUpdateTenantUserMutation,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { useConfirm, useRevealSecret } from "@/components/ui/Dialog";
import { ModuleScopePicker } from "./ModuleScopePicker";
import { moduleLabel } from "@/lib/moduleMeta";

const compactControl = "h-7 text-[12px]";

function roleLabel(role: string, roles: { role_key: string; name: string }[]) {
  return roles.find((r) => r.role_key === role)?.name ?? role;
}

interface UserRowProps {
  user: PortalUser;
  isSelf: boolean;
}

export function UserRow({ user, isSelf }: UserRowProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const revealSecret = useRevealSecret();
  const { data: roles = [] } = useListTenantRolesQuery();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [allowedModules, setAllowedModules] = useState<string[] | null>(
    user.allowed_modules ?? null,
  );
  const [updateUser, { isLoading: saving }] = useUpdateTenantUserMutation();
  const [resetPassword, { isLoading: resetting }] = useResetTenantUserPasswordMutation();

  useEffect(() => {
    setName(user.name);
    setRole(user.role);
    setAllowedModules(user.allowed_modules ?? null);
    setEditing(false);
  }, [user.id, user.name, user.role, user.status, user.allowed_modules]);

  function cancel() {
    setName(user.name);
    setRole(user.role);
    setAllowedModules(user.allowed_modules ?? null);
    setEditing(false);
  }

  async function save() {
    try {
      await updateUser({
        userId: user.id,
        body: {
          name: name.trim(),
          role_key: role,
          allowed_modules: role === "school_admin" ? null : allowedModules,
        },
      }).unwrap();
      toast("Saved.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function toggleActive() {
    const next = user.status === "active" ? "disabled" : "active";
    try {
      await updateUser({ userId: user.id, body: { status: next } }).unwrap();
      toast(next === "disabled" ? "Disabled." : "Re-enabled.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function resetPass() {
    const ok = await confirm({
      title: "Reset password",
      description: `Generate a temporary password for ${user.username}?`,
      confirmLabel: "Reset password",
    });
    if (!ok) return;
    try {
      const result = await resetPassword(user.id).unwrap();
      if (result.email_sent && result.email_recipient) {
        toast(`Temporary password emailed to ${result.email_recipient}.`, "success");
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

  if (!editing) {
    return (
      <>
        <div className="group hidden items-center gap-2 border-b border-slate-50 px-3 py-1.5 last:border-0 hover:bg-slate-50/60 md:flex">
          <span className="w-9 shrink-0 font-mono text-[10px] font-medium text-slate-400">
            {user.login_id}
          </span>
          <span
            className={`min-w-0 flex-1 truncate text-[12px] ${
              user.status === "active" ? "text-slate-700" : "text-slate-400"
            }`}
          >
            {user.name}
          </span>
          <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">
            {roleLabel(user.role, roles)}
          </span>
          {user.role !== "school_admin" && user.allowed_modules != null && (
            <span
              className="hidden shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 md:inline"
              title={
                user.allowed_modules.length
                  ? `Limited to: ${user.allowed_modules.map(moduleLabel).join(", ")}`
                  : "Dashboard only"
              }
            >
              {user.allowed_modules.length} module{user.allowed_modules.length === 1 ? "" : "s"}
            </span>
          )}
          <span className="hidden shrink-0 font-mono text-[10px] text-slate-300 lg:inline">
            {user.username}
          </span>
          {user.status !== "active" && (
            <span className="shrink-0 text-[10px] text-slate-300">Off</span>
          )}
          <div className="flex shrink-0 items-center gap-2 opacity-70 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] text-slate-400 hover:text-brand-700"
            >
              Edit
            </button>
            {!isSelf && (
              <button
                type="button"
                onClick={() => void resetPass()}
                className="text-[11px] text-slate-400 hover:text-brand-700"
              >
                Reset password
              </button>
            )}
            {!isSelf && (
              <button
                type="button"
                onClick={() => void toggleActive()}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                {user.status === "active" ? "Disable" : "Enable"}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 md:hidden">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{user.name}</p>
              <p className="font-mono text-[10px] text-slate-400">{user.login_id} · {user.username}</p>
            </div>
            {user.status !== "active" && (
              <span className="shrink-0 text-[10px] font-medium text-slate-400">Disabled</span>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <dt className="text-slate-400">Role</dt>
            <dd className="text-right text-slate-700">{roleLabel(user.role, roles)}</dd>
            {user.role !== "school_admin" && user.allowed_modules != null && (
              <>
                <dt className="text-slate-400">Modules</dt>
                <dd className="text-right text-slate-700">
                  {user.allowed_modules.length
                    ? user.allowed_modules.map(moduleLabel).join(", ")
                    : "Dashboard only"}
                </dd>
              </>
            )}
          </dl>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => setEditing(true)}>
              Edit
            </Button>
            {!isSelf && (
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => void toggleActive()}>
                {user.status === "active" ? "Disable" : "Enable"}
              </Button>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-2 last:border-0 md:border-b md:border-slate-100">
      <div className="flex flex-wrap items-end gap-2">
        <span className="w-9 shrink-0 pb-1 font-mono text-[10px] font-medium text-slate-500">
          {user.login_id}
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`min-w-[8rem] flex-1 ${compactControl}`}
          aria-label="Display name"
        />
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={isSelf}
          className={`w-36 ${compactControl}`}
          aria-label="Role"
        >
          {roles.map((r) => (
            <option key={r.role_key} value={r.role_key}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-2 pl-9">
        <ModuleScopePicker role={role} value={allowedModules} onChange={setAllowedModules} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-9">
        <span className="font-mono text-[10px] text-slate-400">{user.username}</span>
        {user.last_login_at && (
          <span className="text-[10px] text-slate-400">
            Last sign-in {new Date(user.last_login_at).toLocaleDateString("en-UG")}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-1">
          {!isSelf && (
            <Button size="sm" variant="ghost" loading={resetting} onClick={() => void resetPass()}>
              Reset password
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          <Button size="sm" variant="secondary" loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
