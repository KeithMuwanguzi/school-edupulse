"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/Dialog";
import { parseError } from "@/lib/apiError";
import type { StudentGuardianOut } from "@/lib/types";
import {
  useAddGuardianMutation,
  useDeleteGuardianMutation,
  useListTenantUsersQuery,
  useUpdateGuardianMutation,
} from "@/store/api/skulpulseApi";
import { RELATIONSHIP_OPTIONS, titleCase } from "./studentOptions";

const compactControl = "h-7 text-[12px]";

interface GuardianFormState {
  relationship: string;
  full_name: string;
  phone_primary: string;
  phone_alt: string;
  email: string;
  occupation: string;
  national_id: string;
  address: string;
  is_primary: boolean;
  is_emergency: boolean;
  can_pickup: boolean;
  portal_user_id: string;
}

function emptyForm(): GuardianFormState {
  return {
    relationship: "mother",
    full_name: "",
    phone_primary: "",
    phone_alt: "",
    email: "",
    occupation: "",
    national_id: "",
    address: "",
    is_primary: false,
    is_emergency: false,
    can_pickup: true,
    portal_user_id: "",
  };
}

function fromGuardian(g: StudentGuardianOut): GuardianFormState {
  return {
    relationship: g.relationship,
    full_name: g.full_name,
    phone_primary: g.phone_primary ?? "",
    phone_alt: g.phone_alt ?? "",
    email: g.email ?? "",
    occupation: g.occupation ?? "",
    national_id: g.national_id ?? "",
    address: g.address ?? "",
    is_primary: g.is_primary,
    is_emergency: g.is_emergency,
    can_pickup: g.can_pickup,
    portal_user_id: g.portal_user_id ?? "",
  };
}

function toBody(form: GuardianFormState): Record<string, unknown> {
  return {
    relationship: form.relationship,
    full_name: form.full_name.trim(),
    phone_primary: form.phone_primary.trim() || null,
    phone_alt: form.phone_alt.trim() || null,
    email: form.email.trim() || null,
    occupation: form.occupation.trim() || null,
    national_id: form.national_id.trim() || null,
    address: form.address.trim() || null,
    is_primary: form.is_primary,
    is_emergency: form.is_emergency,
    can_pickup: form.can_pickup,
    portal_user_id: form.portal_user_id || null,
    clear_portal_user: !form.portal_user_id,
  };
}

interface StudentGuardiansPanelProps {
  studentId: string;
  guardians: StudentGuardianOut[];
  isAdmin: boolean;
}

export function StudentGuardiansPanel({ studentId, guardians, isAdmin }: StudentGuardiansPanelProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data: portalUsers = [] } = useListTenantUsersQuery(undefined, { skip: !isAdmin });
  const parents = portalUsers.filter((u) => u.role === "parent");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GuardianFormState>(emptyForm());
  const [addGuardian, { isLoading: creating }] = useAddGuardianMutation();
  const [updateGuardian, { isLoading: updating }] = useUpdateGuardianMutation();
  const [deleteGuardian] = useDeleteGuardianMutation();

  function startAdd() {
    setForm(emptyForm());
    setEditingId(null);
    setAdding(true);
  }

  function startEdit(g: StudentGuardianOut) {
    setForm(fromGuardian(g));
    setEditingId(g.id);
    setAdding(false);
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  async function submit() {
    if (!form.full_name.trim()) {
      toast("Guardian name is required.", "error");
      return;
    }
    try {
      if (editingId) {
        await updateGuardian({ guardianId: editingId, body: toBody(form) }).unwrap();
        toast("Guardian updated.", "success");
      } else {
        await addGuardian({ studentId, body: toBody(form) }).unwrap();
        toast("Guardian added.", "success");
      }
      cancel();
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function remove(g: StudentGuardianOut) {
    const ok = await confirm({
      title: "Remove guardian",
      description: `Remove ${g.full_name} from this learner's profile?`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteGuardian(g.id).unwrap();
      toast("Guardian removed.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  const showForm = adding || editingId !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          {guardians.length} guardian{guardians.length === 1 ? "" : "s"} on record
        </p>
        {isAdmin && !showForm && (
          <Button size="sm" variant="secondary" onClick={startAdd}>
            <Icon name="plus" size={12} />
            Add guardian
          </Button>
        )}
      </div>

      {guardians.length === 0 && !showForm && (
        <EmptyState
          icon={<Icon name="users" size={18} />}
          title="No guardians yet"
          description={isAdmin ? "Add a parent or guardian contact for this learner." : "No guardian contacts recorded."}
        />
      )}

      <ul className="space-y-2">
        {guardians.map((g) => (
          <li
            key={g.id}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-slate-800">{g.full_name}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                    {titleCase(g.relationship)}
                  </span>
                  {g.is_primary && (
                    <span className="rounded-full bg-brand-50 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-brand-700 ring-1 ring-brand-200">
                      Primary
                    </span>
                  )}
                  {g.is_emergency && (
                    <span className="rounded-full bg-gold-50 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-gold-700 ring-1 ring-gold-200">
                      Emergency
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                  {g.phone_primary && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="phone" size={11} /> {g.phone_primary}
                    </span>
                  )}
                  {g.email && <span>{g.email}</span>}
                  {g.occupation && <span>{g.occupation}</span>}
                  {!g.can_pickup && <span className="text-slate-400">No pickup</span>}
                  {g.portal_username && (
                    <span className="inline-flex items-center gap-1 text-brand-600">
                      <Icon name="user" size={11} /> {g.portal_username}
                    </span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(g)}
                    className="text-[11px] text-slate-400 hover:text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(g)}
                    className="text-[11px] text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {showForm && (
        <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/30 p-3">
          <p className="text-[11px] font-semibold text-slate-700">
            {editingId ? "Edit guardian" : "New guardian"}
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Relationship">
              <Select
                value={form.relationship}
                onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
                className={compactControl}
              >
                {RELATIONSHIP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Full name" required>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className={compactControl}
              />
            </FormField>
            <FormField label="Phone">
              <Input
                value={form.phone_primary}
                onChange={(e) => setForm((f) => ({ ...f, phone_primary: e.target.value }))}
                className={compactControl}
                placeholder="+256…"
              />
            </FormField>
            <FormField label="Alt. phone">
              <Input
                value={form.phone_alt}
                onChange={(e) => setForm((f) => ({ ...f, phone_alt: e.target.value }))}
                className={compactControl}
              />
            </FormField>
            <FormField label="Email">
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={compactControl}
              />
            </FormField>
            <FormField label="Occupation">
              <Input
                value={form.occupation}
                onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
                className={compactControl}
              />
            </FormField>
            <FormField label="National ID (NIN)">
              <Input
                value={form.national_id}
                onChange={(e) => setForm((f) => ({ ...f, national_id: e.target.value }))}
                className={compactControl}
              />
            </FormField>
            <FormField label="Address">
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className={compactControl}
              />
            </FormField>
            <FormField label="Portal account" hint="Optional parent login link">
              <Select
                value={form.portal_user_id}
                onChange={(e) => setForm((f) => ({ ...f, portal_user_id: e.target.value }))}
                className={compactControl}
              >
                <option value="">— none —</option>
                {parents.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                className="rounded border-slate-300"
              />
              Primary contact
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={form.is_emergency}
                onChange={(e) => setForm((f) => ({ ...f, is_emergency: e.target.checked }))}
                className="rounded border-slate-300"
              />
              Emergency contact
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={form.can_pickup}
                onChange={(e) => setForm((f) => ({ ...f, can_pickup: e.target.checked }))}
                className="rounded border-slate-300"
              />
              Allowed to pick up
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button size="sm" loading={creating || updating} onClick={() => void submit()}>
              {editingId ? "Save guardian" : "Add guardian"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
