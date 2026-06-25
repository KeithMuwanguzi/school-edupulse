"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { parseError } from "@/lib/apiError";
import {
  useCreateAdmissionApplicationMutation,
  useListClassesQuery,
} from "@/store/api/skulpulseApi";
import { useToast } from "@/components/ui/Toast";
import { GENDER_OPTIONS, RELATIONSHIP_OPTIONS, STUDENT_NAME_LABELS, studentNameRequiredMessage } from "../students/studentOptions";

const compactControl = "h-7 text-[12px]";
const LEVELS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7"];

export function NewAdmissionApplicationForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: classes = [] } = useListClassesQuery();
  const [createApplication, { isLoading }] = useCreateAdmissionApplicationMutation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("mother");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [notes, setNotes] = useState("");

  const selectedClass = classes.find((c) => c.id === classId);
  const streams = selectedClass?.streams.filter((s) => s.is_active) ?? [];

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) {
      toast(studentNameRequiredMessage("applicant"), "error");
      return;
    }
    try {
      const created = await createApplication({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_name: middleName.trim() || undefined,
        gender: gender || undefined,
        date_of_birth: dob || undefined,
        applied_class_level: classLevel || undefined,
        applied_class_id: classId || undefined,
        applied_stream_id: streamId || undefined,
        guardian_name: guardianName.trim() || undefined,
        guardian_relationship: guardianRelationship || undefined,
        guardian_phone: guardianPhone.trim() || undefined,
        guardian_email: guardianEmail.trim() || undefined,
        previous_school: previousSchool.trim() || undefined,
        notes: notes.trim() || undefined,
      }).unwrap();
      toast(`${created.first_name} ${created.last_name} added to the pipeline.`, "success");
      router.push("/app/m/admissions");
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <Card>
      <CardHeader
        title="New application"
        description="Capture a prospective learner before full enrollment. Accepted applicants can be enrolled into the student registry."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label={STUDENT_NAME_LABELS.last_name} required>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className={compactControl} />
          </FormField>
          <FormField label={STUDENT_NAME_LABELS.middle_name}>
            <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={compactControl} />
          </FormField>
          <FormField label={STUDENT_NAME_LABELS.first_name} required>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={compactControl} />
          </FormField>
          <FormField label="Gender">
            <Select value={gender} onChange={(e) => setGender(e.target.value)} className={compactControl}>
              <option value="">—</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date of birth">
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={compactControl} />
          </FormField>
          <FormField label="Entry class">
            <Select value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className={compactControl}>
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Class (optional)">
            <Select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setStreamId("");
              }}
              className={compactControl}
            >
              <option value="">—</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.level} · {c.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Stream">
            <Select
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
              className={compactControl}
              disabled={streams.length === 0}
            >
              <option value="">—</option>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Previous school">
            <Input value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className={compactControl} />
          </FormField>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Guardian contact
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Guardian name">
              <Input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className={compactControl} />
            </FormField>
            <FormField label="Relationship">
              <Select
                value={guardianRelationship}
                onChange={(e) => setGuardianRelationship(e.target.value)}
                className={compactControl}
              >
                {RELATIONSHIP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Phone">
              <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} className={compactControl} />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} className={compactControl} />
            </FormField>
          </div>
        </div>

        <FormField label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} className={compactControl} />
        </FormField>

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => router.push("/app/m/admissions")}>
            Cancel
          </Button>
          <Button size="sm" loading={isLoading} onClick={() => void submit()}>
            Save application
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
