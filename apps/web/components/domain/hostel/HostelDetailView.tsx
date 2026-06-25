"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatStudentFullName } from "@/components/domain/students/studentOptions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { HostelRoomOut } from "@/lib/types";
import {
  useAllocateHostelMutation,
  useCheckoutHostelMutation,
  useCreateHostelRoomMutation,
  useDeleteHostelMutation,
  useDeleteHostelRoomMutation,
  useGetHostelQuery,
  useListTenantUsersQuery,
  useUpdateHostelMutation,
  useUpdateHostelRoomMutation,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";
import { OccupancyBar } from "./OccupancyBar";
import {
  HOSTEL_GENDER_OPTIONS,
  genderLabel,
  genderTone,
  occupancyLabel,
} from "./hostelUtils";

const compactControl = "h-7 text-[12px]";

export function HostelDetailView({ hostelId }: { hostelId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role === "school_admin" || user?.role === "deputy_head";

  const { data: hostel, isLoading, isError, error } = useGetHostelQuery(hostelId);
  const { data: users = [] } = useListTenantUsersQuery(undefined, { skip: !isAdmin });

  const [updateHostel, { isLoading: saving }] = useUpdateHostelMutation();
  const [deleteHostel, { isLoading: deleting }] = useDeleteHostelMutation();
  const [createRoom, { isLoading: creatingRoom }] = useCreateHostelRoomMutation();
  const [updateRoom, { isLoading: savingRoom }] = useUpdateHostelRoomMutation();
  const [deleteRoom] = useDeleteHostelRoomMutation();
  const [allocate, { isLoading: allocating }] = useAllocateHostelMutation();
  const [checkout] = useCheckoutHostelMutation();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    gender: "mixed",
    capacity: "",
    warden_user_id: "",
    location: "",
    is_active: true,
  });

  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("");
  const [roomFloor, setRoomFloor] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomDraft, setRoomDraft] = useState({ name: "", capacity: "", floor: "" });
  const [movingId, setMovingId] = useState<string | null>(null);

  const staff = useMemo(
    () => users.filter((u) => u.role !== "parent" && u.status === "active"),
    [users],
  );

  useEffect(() => {
    if (hostel) {
      setForm({
        name: hostel.name,
        code: hostel.code ?? "",
        gender: hostel.gender,
        capacity: hostel.capacity != null ? String(hostel.capacity) : "",
        warden_user_id: hostel.warden_user_id ?? "",
        location: hostel.location ?? "",
        is_active: hostel.is_active,
      });
    }
  }, [hostel]);

  if (isLoading) return <PageLoader />;
  if (isError || !hostel) {
    return <ErrorBanner message={isError ? parseError(error).message : "Hostel not found."} />;
  }

  async function saveHostel() {
    try {
      await updateHostel({
        hostelId,
        body: {
          name: form.name.trim(),
          code: form.code.trim() || null,
          gender: form.gender,
          capacity: form.capacity.trim() ? Number(form.capacity) : null,
          warden_user_id: form.warden_user_id || null,
          clear_warden: !form.warden_user_id,
          location: form.location.trim() || null,
          is_active: form.is_active,
        },
      }).unwrap();
      toast("Hostel updated.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function removeHostel() {
    if (!window.confirm(`Delete ${hostel!.name}? This cannot be undone.`)) return;
    try {
      await deleteHostel(hostelId).unwrap();
      toast("Hostel deleted.", "success");
      router.push("/app/m/hostel");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function addRoom() {
    if (!roomName.trim()) {
      toast("Enter a room name.", "error");
      return;
    }
    try {
      await createRoom({
        hostelId,
        body: {
          name: roomName.trim(),
          capacity: roomCapacity.trim() ? Number(roomCapacity) : 0,
          floor: roomFloor.trim() || null,
        },
      }).unwrap();
      setRoomName("");
      setRoomCapacity("");
      setRoomFloor("");
      toast("Room added.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function saveRoom(roomId: string) {
    if (!roomDraft.name.trim()) {
      toast("Enter a room name.", "error");
      return;
    }
    try {
      await updateRoom({
        hostelId,
        roomId,
        body: {
          name: roomDraft.name.trim(),
          capacity: roomDraft.capacity.trim() ? Number(roomDraft.capacity) : 0,
          floor: roomDraft.floor.trim() || null,
        },
      }).unwrap();
      setEditingRoomId(null);
      toast("Room updated.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  function startEditRoom(room: HostelRoomOut) {
    setEditingRoomId(room.id);
    setRoomDraft({
      name: room.name,
      capacity: room.capacity != null ? String(room.capacity) : "",
      floor: room.floor ?? "",
    });
  }

  async function removeRoom(room: HostelRoomOut) {
    if (!window.confirm(`Delete room ${room.name}?`)) return;
    try {
      await deleteRoom({ hostelId, roomId: room.id }).unwrap();
      toast("Room deleted.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  async function moveResident(studentId: string, roomId: string) {
    setMovingId(studentId);
    try {
      await allocate({
        student_id: studentId,
        hostel_id: hostelId,
        hostel_room_id: roomId || null,
      }).unwrap();
      toast("Room updated.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    } finally {
      setMovingId(null);
    }
  }

  async function checkoutResident(studentId: string, name: string) {
    if (!window.confirm(`Check ${name} out of ${hostel!.name}?`)) return;
    try {
      await checkout({ student_id: studentId }).unwrap();
      toast("Resident checked out.", "success");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/app/m/hostel"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600"
        >
          <Icon name="list" size={12} />
          All hostels
        </Link>
      </div>

      <PageHeader
        eyebrow="Boarding"
        title={hostel.name}
        description={[hostel.code, hostel.location].filter(Boolean).join(" · ") || undefined}
        action={
          isAdmin ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
                <Icon name="settings" size={13} />
                {editing ? "Close" : "Edit"}
              </Button>
              <Button variant="danger" loading={deleting} onClick={removeHostel}>
                <Icon name="x" size={13} />
                Delete
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge tone={genderTone(hostel.gender)}>{genderLabel(hostel.gender)}</Badge>
              {hostel.is_active ? (
                <Badge tone="green" dot>Active</Badge>
              ) : (
                <Badge tone="neutral">Inactive</Badge>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between text-[12px] text-slate-600">
                <span>Occupancy</span>
                <span className="font-semibold tabular-nums">
                  {occupancyLabel(hostel.occupied, hostel.effective_capacity)}
                </span>
              </div>
              <OccupancyBar
                occupied={hostel.occupied}
                capacity={hostel.effective_capacity}
                pct={hostel.occupancy_pct}
                className="mt-1.5"
              />
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-[11px]">
              <dt className="text-slate-400">Rooms</dt>
              <dd className="text-right font-medium text-slate-700">{hostel.room_count}</dd>
              <dt className="text-slate-400">Available</dt>
              <dd className="text-right font-medium text-slate-700">{hostel.available ?? "—"}</dd>
              <dt className="text-slate-400">Unassigned</dt>
              <dd className="text-right font-medium text-slate-700">{hostel.unassigned_residents}</dd>
              <dt className="text-slate-400">Warden</dt>
              <dd className="text-right font-medium text-slate-700">{hostel.warden_name ?? "—"}</dd>
            </dl>
          </CardBody>
        </Card>

        {editing && isAdmin ? (
          <Card className="lg:col-span-2">
            <CardHeader title="Edit hostel" />
            <CardBody className="space-y-3">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Name" required>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={compactControl} />
                </FormField>
                <FormField label="Code">
                  <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={compactControl} />
                </FormField>
                <FormField label="Gender">
                  <Select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className={compactControl}>
                    {HOSTEL_GENDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Capacity" hint="Blank = derive from rooms.">
                  <Input type="number" min={0} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} className={compactControl} />
                </FormField>
                <FormField label="Warden">
                  <Select value={form.warden_user_id} onChange={(e) => setForm((f) => ({ ...f, warden_user_id: e.target.value }))} className={compactControl}>
                    <option value="">—</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Location">
                  <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className={compactControl} />
                </FormField>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                Active (accepting new residents)
              </label>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" loading={saving} onClick={() => void saveHostel()}>Save changes</Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader
              icon={<Icon name="grid" size={13} />}
              title="Rooms"
              description="Dormitory rooms and their bed capacity."
            />
            <CardBody className="space-y-3">
              {hostel.rooms.length === 0 ? (
                <p className="text-[12px] text-slate-400">No rooms yet. Add one below.</p>
              ) : (
                <div className="space-y-2">
                  {hostel.rooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200/80 px-3 py-2"
                    >
                      {editingRoomId === room.id ? (
                        <>
                          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-3">
                            <Input
                              value={roomDraft.name}
                              onChange={(e) => setRoomDraft((d) => ({ ...d, name: e.target.value }))}
                              className={compactControl}
                              placeholder="Room name"
                            />
                            <Input
                              type="number"
                              min={0}
                              value={roomDraft.capacity}
                              onChange={(e) => setRoomDraft((d) => ({ ...d, capacity: e.target.value }))}
                              className={compactControl}
                              placeholder="Beds"
                            />
                            <Input
                              value={roomDraft.floor}
                              onChange={(e) => setRoomDraft((d) => ({ ...d, floor: e.target.value }))}
                              className={compactControl}
                              placeholder="Floor"
                            />
                          </div>
                          <Button size="sm" loading={savingRoom} onClick={() => void saveRoom(room.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingRoomId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-medium text-slate-800">
                              {room.name}
                              {room.floor ? <span className="ml-1 text-[10px] text-slate-400">· {room.floor}</span> : null}
                            </p>
                            <OccupancyBar occupied={room.occupied} capacity={room.capacity || null} className="mt-1" />
                          </div>
                          <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                            {room.capacity ? `${room.occupied}/${room.capacity}` : `${room.occupied}`}
                          </span>
                          {isAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditRoom(room)}
                                className="shrink-0 text-slate-300 hover:text-brand-700"
                                aria-label={`Edit ${room.name}`}
                              >
                                <Icon name="edit" size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRoom(room)}
                                className="shrink-0 text-slate-300 hover:text-red-600"
                                aria-label={`Delete ${room.name}`}
                              >
                                <Icon name="x" size={14} />
                              </button>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isAdmin ? (
                <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                  <FormField label="Room name">
                    <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g. Room 1" className={`${compactControl} w-32`} />
                  </FormField>
                  <FormField label="Beds">
                    <Input type="number" min={0} value={roomCapacity} onChange={(e) => setRoomCapacity(e.target.value)} placeholder="0" className={`${compactControl} w-20`} />
                  </FormField>
                  <FormField label="Floor">
                    <Input value={roomFloor} onChange={(e) => setRoomFloor(e.target.value)} placeholder="Optional" className={`${compactControl} w-24`} />
                  </FormField>
                  <Button size="sm" loading={creatingRoom} onClick={() => void addRoom()}>
                    <Icon name="plus" size={12} />
                    Add room
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader
          icon={<Icon name="users" size={13} />}
          title={`Residents (${hostel.residents.length})`}
          description="Boarders allocated to this hostel. Assign a room or check a resident out."
        />
        <CardBody className="overflow-x-auto py-0">
          {hostel.residents.length === 0 ? (
            <EmptyState
              icon={<Icon name="bed" size={18} />}
              title="No residents yet"
              description="Allocate boarders here, or during enrollment by choosing this hostel."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Resident</TH>
                  <TH>Class</TH>
                  <TH>Room</TH>
                  {isAdmin ? <TH className="text-right">Actions</TH> : null}
                </TR>
              </THead>
              <TBody>
                {hostel.residents.map((r) => {
                  const name = formatStudentFullName({
                    last_name: r.last_name,
                    middle_name: r.middle_name,
                    first_name: r.first_name,
                  });
                  return (
                    <TR key={r.student_id}>
                      <TD>
                        <Link href={`/app/m/students/${r.student_id}`} className="font-medium text-brand-700 hover:underline">
                          {name}
                        </Link>
                        <p className="font-mono text-[10px] text-slate-400">{r.student_number}</p>
                      </TD>
                      <TD>{[r.class_label, r.stream_name].filter(Boolean).join(" · ") || "—"}</TD>
                      <TD>
                        {isAdmin ? (
                          <Select
                            value={r.hostel_room_id ?? ""}
                            disabled={movingId === r.student_id || allocating}
                            onChange={(e) => moveResident(r.student_id, e.target.value)}
                            className={`${compactControl} w-32`}
                          >
                            <option value="">Unassigned</option>
                            {hostel.rooms.map((room) => (
                              <option key={room.id} value={room.id}>{room.name}</option>
                            ))}
                          </Select>
                        ) : (
                          r.room_name ?? "Unassigned"
                        )}
                      </TD>
                      {isAdmin ? (
                        <TD className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => checkoutResident(r.student_id, name)}
                          >
                            Check out
                          </Button>
                        </TD>
                      ) : null}
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
