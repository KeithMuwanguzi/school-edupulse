"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { StudentDetailOut } from "@/lib/types";
import { useListClassesQuery, useUpdateStudentMutation } from "@/store/api/skulpulseApi";
import {
  GENDER_OPTIONS,
  isUgandanNationality,
  RESIDENCE_OPTIONS,
  STATUS_OPTIONS,
  titleCase,
  STUDENT_NAME_LABELS,
  formatStudentFullName,
} from "./studentOptions";
import {
  DistrictField,
  NationalityField,
  ReligionField,
} from "./StudentDemographicFields";

const compactControl = "h-7 text-[12px]";

interface InfoForm {
  first_name: string;
  middle_name: string;
  last_name: string;
  preferred_name: string;
  lin: string;
  gender: string;
  date_of_birth: string;
  nationality: string;
  religion: string;
  status: string;
  residence: string;
  house: string;
  admission_date: string;
  previous_school: string;
  home_address: string;
  village: string;
  district: string;
  class_id: string;
  stream_id: string;
}

function fromStudent(s: StudentDetailOut): InfoForm {
  return {
    first_name: s.first_name,
    middle_name: s.middle_name ?? "",
    last_name: s.last_name,
    preferred_name: s.preferred_name ?? "",
    lin: s.lin ?? "",
    gender: s.gender ?? "",
    date_of_birth: s.date_of_birth ?? "",
    nationality: s.nationality ?? "",
    religion: s.religion ?? "",
    status: s.status,
    residence: s.residence ?? "",
    house: s.house ?? "",
    admission_date: s.admission_date ?? "",
    previous_school: s.previous_school ?? "",
    home_address: s.home_address ?? "",
    village: s.village ?? "",
    district: s.district ?? "",
    class_id: s.class_id ?? "",
    stream_id: s.stream_id ?? "",
  };
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-50 py-1">
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="text-right text-[12px] text-slate-700">{value || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {title}
      </p>
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">{children}</dl>
    </div>
  );
}

interface StudentInfoPanelProps {
  student: StudentDetailOut;
  isAdmin: boolean;
}

export function StudentInfoPanel({ student, isAdmin }: StudentInfoPanelProps) {
  const { toast } = useToast();
  const { data: classes = [] } = useListClassesQuery();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<InfoForm>(fromStudent(student));
  const [updateStudent, { isLoading }] = useUpdateStudentMutation();

  const selectedClass = classes.find((c) => c.id === form.class_id);
  const streams = useMemo(
    () => selectedClass?.streams.filter((s) => s.is_active) ?? [],
    [selectedClass],
  );

  function startEdit() {
    setForm(fromStudent(student));
    setEditing(true);
  }

  async function save() {
    try {
      await updateStudent({
        studentId: student.id,
        body: {
          first_name: form.first_name.trim(),
          middle_name: form.middle_name.trim() || null,
          last_name: form.last_name.trim(),
          preferred_name: form.preferred_name.trim() || null,
          lin: form.lin.trim() || null,
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          nationality: form.nationality.trim() || null,
          religion: form.religion.trim() || null,
          status: form.status,
          residence: form.residence || null,
          house: form.house.trim() || null,
          admission_date: form.admission_date || null,
          previous_school: form.previous_school.trim() || null,
          home_address: form.home_address.trim() || null,
          village: form.village.trim() || null,
          district: isUgandanNationality(form.nationality) ? form.district.trim() || null : null,
          class_id: form.class_id || null,
          stream_id: form.stream_id || null,
          clear_class: !form.class_id,
        },
      }).unwrap();
      toast("Student details saved.", "success");
      setEditing(false);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  if (!editing) {
    const placement = student.class_level
      ? student.stream_name
        ? `${student.class_level} · ${student.stream_name}`
        : student.class_level
      : "Unassigned";
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">Learner information</p>
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={startEdit}>
              <Icon name="settings" size={12} />
              Edit details
            </Button>
          )}
        </div>
        <Section title="Identity">
          <Row label="Full name" value={formatStudentFullName(student)} />
          <Row label="Preferred name" value={student.preferred_name} />
          <Row label="Gender" value={titleCase(student.gender)} />
          <Row label="Date of birth" value={student.date_of_birth} />
          <Row label="LIN" value={student.lin} />
          <Row label="Nationality" value={student.nationality} />
          <Row label="Religion" value={student.religion} />
        </Section>
        <Section title="Enrollment">
          <Row label="Status" value={titleCase(student.status)} />
          <Row label="Placement" value={placement} />
          <Row label="Residence" value={titleCase(student.residence)} />
          <Row label="House" value={student.house} />
          <Row label="Admission date" value={student.admission_date} />
          <Row label="Previous school" value={student.previous_school} />
        </Section>
        <Section title="Location">
          <Row label="Home address" value={student.home_address} />
          <Row label="Village" value={student.village} />
          {isUgandanNationality(student.nationality) && (
            <Row label="District" value={student.district} />
          )}
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Identity
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={STUDENT_NAME_LABELS.last_name} required>
            <Input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label={STUDENT_NAME_LABELS.middle_name}>
            <Input value={form.middle_name} onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label={STUDENT_NAME_LABELS.first_name} required>
            <Input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label="Preferred name">
            <Input value={form.preferred_name} onChange={(e) => setForm((f) => ({ ...f, preferred_name: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label="LIN">
            <Input value={form.lin} onChange={(e) => setForm((f) => ({ ...f, lin: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label="Gender">
            <Select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className={compactControl}>
              <option value="">—</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date of birth">
            <Input type="date" value={form.date_of_birth} onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label="Nationality">
            <NationalityField
              value={form.nationality}
              onChange={(nationality) =>
                setForm((f) => ({
                  ...f,
                  nationality,
                  district: isUgandanNationality(nationality) ? f.district : "",
                }))
              }
              className={compactControl}
            />
          </FormField>
          <FormField label="Religion">
            <ReligionField
              value={form.religion}
              onChange={(religion) => setForm((f) => ({ ...f, religion }))}
              className={compactControl}
            />
          </FormField>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Enrollment
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Status">
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={compactControl}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Class">
            <Select
              value={form.class_id}
              onChange={(e) => setForm((f) => ({ ...f, class_id: e.target.value, stream_id: "" }))}
              className={compactControl}
            >
              <option value="">Unassigned</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.level} · {c.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Stream">
            <Select
              value={form.stream_id}
              onChange={(e) => setForm((f) => ({ ...f, stream_id: e.target.value }))}
              className={compactControl}
              disabled={streams.length === 0}
            >
              <option value="">—</option>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Residence">
            <Select value={form.residence} onChange={(e) => setForm((f) => ({ ...f, residence: e.target.value }))} className={compactControl}>
              <option value="">—</option>
              {RESIDENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="House">
            <Input value={form.house} onChange={(e) => setForm((f) => ({ ...f, house: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label="Admission date">
            <Input type="date" value={form.admission_date} onChange={(e) => setForm((f) => ({ ...f, admission_date: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label="Previous school">
            <Input value={form.previous_school} onChange={(e) => setForm((f) => ({ ...f, previous_school: e.target.value }))} className={compactControl} />
          </FormField>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          Location
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="Home address">
            <Input value={form.home_address} onChange={(e) => setForm((f) => ({ ...f, home_address: e.target.value }))} className={compactControl} />
          </FormField>
          <FormField label="Village">
            <Input value={form.village} onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))} className={compactControl} />
          </FormField>
          <DistrictField
            nationality={form.nationality}
            value={form.district}
            onChange={(district) => setForm((f) => ({ ...f, district }))}
            className={compactControl}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" loading={isLoading} onClick={() => void save()}>
          Save details
        </Button>
      </div>
    </div>
  );
}
