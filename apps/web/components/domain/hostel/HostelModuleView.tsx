"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { PageLoader } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import { HOSTEL_READ_ROLES, roleHasAny } from "@/lib/roleAccess";
import {
  useCreateHostelMutation,
  useListHostelsQuery,
  useListTenantUsersQuery,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { OccupancyBar } from "./OccupancyBar";
import {
  HOSTEL_GENDER_OPTIONS,
  genderLabel,
  genderTone,
  occupancyLabel,
} from "./hostelUtils";

const compactControl = "h-7 text-[12px]";

function SummaryStat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function HostelModuleView() {
  const { toast } = useToast();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role === "school_admin" || user?.role === "deputy_head";
  const canView = roleHasAny(user?.role, ...HOSTEL_READ_ROLES);

  const { data: hostels = [], isLoading, isError, error } = useListHostelsQuery(undefined, {
    skip: !canView,
  });
  const { data: users = [] } = useListTenantUsersQuery(undefined, { skip: !isAdmin });
  const [createHostel, { isLoading: creating }] = useCreateHostelMutation();

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gender, setGender] = useState<string>("mixed");
  const [capacity, setCapacity] = useState("");
  const [wardenId, setWardenId] = useState("");
  const [location, setLocation] = useState("");

  const staff = useMemo(
    () => users.filter((u) => u.role !== "parent" && u.status === "active"),
    [users],
  );

  const totals = useMemo(() => {
    const beds = hostels.reduce((acc, h) => acc + (h.effective_capacity ?? 0), 0);
    const occupied = hostels.reduce((acc, h) => acc + h.occupied, 0);
    const tracked = hostels.some((h) => h.effective_capacity != null);
    return {
      hostels: hostels.length,
      beds,
      occupied,
      available: tracked ? Math.max(0, beds - occupied) : null,
    };
  }, [hostels]);

  if (!canView) {
    return (
      <AccessDenied
        title="Boarding access restricted"
        description="Only administrators, deputy heads, and bursars can view hostel records. Contact your school administrator if you need access."
      />
    );
  }

  if (isLoading) return <PageLoader />;

  function resetForm() {
    setName("");
    setCode("");
    setGender("mixed");
    setCapacity("");
    setWardenId("");
    setLocation("");
  }

  async function submit() {
    if (!name.trim()) {
      toast("Enter a hostel name.", "error");
      return;
    }
    try {
      await createHostel({
        name: name.trim(),
        code: code.trim() || null,
        gender,
        capacity: capacity.trim() ? Number(capacity) : null,
        warden_user_id: wardenId || null,
        location: location.trim() || null,
      }).unwrap();
      toast(`${name.trim()} created.`, "success");
      resetForm();
      setAddOpen(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Add-ons · Boarding"
        title="Boarding & hostels"
        description="Set up dormitories and rooms, then allocate boarders during enrollment or from each hostel's roll."
        action={
          isAdmin ? (
            <Button onClick={() => setAddOpen((v) => !v)} variant={addOpen ? "secondary" : "primary"}>
              <Icon name={addOpen ? "x" : "plus"} size={13} />
              {addOpen ? "Close" : "New hostel"}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat label="Hostels" value={totals.hostels} />
        <SummaryStat label="Beds" value={totals.beds || "—"} hint="Across all dormitories" />
        <SummaryStat label="Occupied" value={totals.occupied} />
        <SummaryStat label="Available" value={totals.available ?? "—"} />
      </div>

      {isError ? <ErrorBanner message={parseError(error).message} /> : null}

      {addOpen && isAdmin ? (
        <Card>
          <CardHeader
            icon={<Icon name="bed" size={13} />}
            title="New hostel"
            description="A hostel is a boarding house. Add rooms to it after creating it."
          />
          <CardBody className="space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. St. Mary's Dormitory"
                  className={compactControl}
                />
              </FormField>
              <FormField label="Code">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. SMD"
                  className={compactControl}
                />
              </FormField>
              <FormField label="Gender" required>
                <Select value={gender} onChange={(e) => setGender(e.target.value)} className={compactControl}>
                  {HOSTEL_GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Capacity" hint="Leave blank to derive from room beds.">
                <Input
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Optional"
                  className={compactControl}
                />
              </FormField>
              <FormField label="Warden">
                <Select value={wardenId} onChange={(e) => setWardenId(e.target.value)} className={compactControl}>
                  <option value="">—</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Location">
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. East wing"
                  className={compactControl}
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { resetForm(); setAddOpen(false); }}>
                Cancel
              </Button>
              <Button size="sm" loading={creating} onClick={() => void submit()}>
                Create hostel
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {hostels.length === 0 ? (
        !addOpen ? (
          <EmptyState
            icon={<Icon name="bed" size={18} />}
            title="No hostels yet"
            description="Create your first dormitory to start allocating boarders."
            action={
              isAdmin ? (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Icon name="plus" size={13} />
                  New hostel
                </Button>
              ) : undefined
            }
          />
        ) : null
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hostels.map((h) => (
            <Link key={h.id} href={`/app/m/hostel/${h.id}`} className="block">
              <Card interactive className="h-full">
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-slate-900">{h.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {h.code ? `${h.code} · ` : ""}
                        {h.room_count} room{h.room_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge tone={genderTone(h.gender)}>{genderLabel(h.gender)}</Badge>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Occupancy</span>
                      <span className="font-medium tabular-nums">
                        {occupancyLabel(h.occupied, h.effective_capacity)}
                      </span>
                    </div>
                    <OccupancyBar
                      occupied={h.occupied}
                      capacity={h.effective_capacity}
                      pct={h.occupancy_pct}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="user" size={11} />
                      {h.warden_name ?? "No warden"}
                    </span>
                    {!h.is_active ? <Badge tone="neutral">Inactive</Badge> : null}
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
