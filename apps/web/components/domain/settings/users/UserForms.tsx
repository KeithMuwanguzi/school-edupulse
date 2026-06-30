"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import {
  useCreateTenantUserMutation,
  useListTenantRolesQuery,
  useNextLoginIdQuery,
} from "@/store/api/skulpulseApi";
import { ModuleScopePicker } from "./ModuleScopePicker";

const compactControl = "h-7 text-[12px]";

interface UserAddPanelProps {
  schoolCode: string;
  parentPortalEnabled?: boolean;
}

export function UserAddPanel({ schoolCode, parentPortalEnabled = false }: UserAddPanelProps) {
  const { toast } = useToast();
  const { data: roles = [] } = useListTenantRolesQuery();
  const [createUser, { isLoading }] = useCreateTenantUserMutation();
  const [parentLoginId, setParentLoginId] = useState("");
  const [name, setName] = useState("");
  const [roleKey, setRoleKey] = useState("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);

  const assignableRoles = useMemo(
    () =>
      parentPortalEnabled ? roles : roles.filter((r) => r.role_key !== "parent"),
    [parentPortalEnabled, roles],
  );

  const isParent = roleKey === "parent";
  const { data: nextLogin } = useNextLoginIdQuery(undefined, { skip: isParent });

  const staffLoginId = nextLogin?.login_id ?? "…";
  const displayLoginId = isParent ? parentLoginId.trim() : staffLoginId;

  const canSubmit = useMemo(() => {
    if (!name.trim() || password.length < 8) return false;
    if (isParent) return parentLoginId.trim().length >= 2;
    return email.trim().length > 0;
  }, [isParent, name, parentLoginId, password, email]);

  async function submit() {
    try {
      const payload = {
        name: name.trim(),
        role_key: roleKey,
        email: email.trim() || undefined,
        password,
        allowed_modules: roleKey === "school_admin" ? null : allowedModules,
        ...(isParent ? { login_id: parentLoginId.trim() } : {}),
      };
      const created = await createUser(payload).unwrap();
      toast(
        isParent
          ? `Account ${created.username} created.`
          : `Account ${created.username} created. Sign-in details were emailed to ${email.trim()}.`,
        "success",
      );
      setParentLoginId("");
      setName("");
      setEmail("");
      setPassword("");
      setRoleKey("teacher");
      setAllowedModules(null);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Role">
          <Select
            value={roleKey}
            onChange={(e) => setRoleKey(e.target.value)}
            className={compactControl}
          >
            {assignableRoles.map((r) => (
              <option key={r.role_key} value={r.role_key}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormField>
        {isParent ? (
          <FormField
            label="Student number"
            hint="Guardian username prefix"
            required
          >
            <Input
              value={parentLoginId}
              onChange={(e) => setParentLoginId(e.target.value)}
              placeholder="2203992"
              maxLength={20}
              required
              className={compactControl}
            />
          </FormField>
        ) : (
          <FormField label="Login ID" hint={`Assigned automatically · @${schoolCode}`}>
            <Input
              value={staffLoginId}
              readOnly
              className={`${compactControl} bg-slate-50 font-mono text-slate-600`}
            />
          </FormField>
        )}
        <FormField label={isParent ? "Guardian name" : "Full name"} required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
            required
            className={compactControl}
          />
        </FormField>
        <FormField label="Email" required={!isParent}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isParent ? "Optional" : "Required for credentials email"}
            required={!isParent}
            className={compactControl}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Temporary password" hint="Minimum 8 characters" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            className={`w-48 ${compactControl}`}
          />
        </FormField>
        {displayLoginId && displayLoginId !== "…" && (
          <p className="pb-1.5 text-[11px] text-slate-500">
            Signs in as{" "}
            <span className="font-mono text-slate-700">
              {displayLoginId}@{schoolCode}
            </span>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
        <p className="mb-1.5 text-[11px] font-medium text-slate-600">Module access</p>
        <ModuleScopePicker
          role={roleKey}
          value={allowedModules}
          onChange={setAllowedModules}
        />
      </div>

      <div>
        <Button type="submit" size="sm" loading={isLoading} disabled={!canSubmit}>
          Create account
        </Button>
      </div>
    </form>
  );
}

export function ImportResultList({
  result,
}: {
  result: {
    created: number;
    skipped: number;
    failed: number;
    results: {
      line: number;
      identifier: string;
      status: string;
      username?: string | null;
      temporary_password?: string | null;
      message?: string | null;
    }[];
  } | null;
}) {
  const rows = useMemo(() => result?.results.filter((r) => r.status === "created") ?? [], [result]);
  if (!result) return null;

  function copyPasswords() {
    const text = rows
      .map((r) => `${r.username}\t${r.temporary_password ?? ""}`)
      .join("\n");
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-2 border-t border-slate-100 pt-2.5">
      <p className="text-[10px] text-slate-400">
        <span className="font-medium text-slate-600">{result.created} created</span>
        {" · "}
        {result.skipped} skipped · {result.failed} failed
      </p>
      {rows.length > 0 && (
        <Button size="sm" variant="ghost" onClick={copyPasswords}>
          Copy usernames & passwords
        </Button>
      )}
      <ul className="max-h-28 space-y-0.5 overflow-y-auto">
        {result.results.map((r) => (
          <li
            key={`${r.line}-${r.identifier}`}
            className={cn(
              "font-mono text-[10px] leading-relaxed",
              r.status === "created" && "text-brand-800",
              r.status === "skipped" && "text-slate-400",
              r.status === "failed" && "text-amber-800",
            )}
          >
            {r.line}. {r.identifier}
            {r.username ? ` → ${r.username}` : ""}
            {r.message ? ` — ${r.message}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
