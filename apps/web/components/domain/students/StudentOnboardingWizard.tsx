"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import { PageLoader } from "@/components/ui/Spinner";
import { SettingsHint } from "@/components/layout/settingsUi";
import { cn } from "@/lib/cn";
import { parseError } from "@/lib/apiError";
import { schoolHasParentsPortal } from "@/lib/parentPortal";
import {
  useCreateStudentMutation,
  useGetAdmissionApplicationQuery,
  useGetTenantModulesQuery,
  useHostelOptionsQuery,
  useLinkAdmissionEnrollmentMutation,
  useListClassesQuery,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";
import { useToast } from "@/components/ui/Toast";
import {
  BLOOD_GROUP_OPTIONS,
  GENDER_OPTIONS,
  isUgandanNationality,
  RELATIONSHIP_OPTIONS,
  RESIDENCE_OPTIONS,
  STUDENT_NAME_LABELS,
  validateOnboardingStep,
  formatStudentFullName,
} from "./studentOptions";
import {
  DistrictField,
  NationalityField,
  ReligionField,
} from "./StudentDemographicFields";

const compactControl = "h-7 text-[12px]";

const STEPS = ["Identity", "Placement", "Guardians", "Health", "Review"] as const;

interface GuardianDraft {
  relationship: string;
  full_name: string;
  phone_primary: string;
  email: string;
  occupation: string;
  national_id: string;
  is_primary: boolean;
  is_emergency: boolean;
  can_pickup: boolean;
}

function newGuardian(isPrimary: boolean): GuardianDraft {
  return {
    relationship: "mother",
    full_name: "",
    phone_primary: "",
    email: "",
    occupation: "",
    national_id: "",
    is_primary: isPrimary,
    is_emergency: isPrimary,
    can_pickup: true,
  };
}

export function StudentOnboardingWizard({
  applicationId,
  backHref = "/app/m/students",
}: {
  applicationId?: string;
  backHref?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const hostelEnabled = useAppSelector((s) => s.auth.user?.modules.includes("hostel") ?? false);
  const { data: tenantModules } = useGetTenantModulesQuery();
  const parentPortalEnabled = schoolHasParentsPortal(tenantModules?.modules);
  const { data: classes = [] } = useListClassesQuery();
  const { data: application, isLoading: loadingApplication } = useGetAdmissionApplicationQuery(
    applicationId!,
    { skip: !applicationId },
  );
  const [createStudent, { isLoading }] = useCreateStudentMutation();
  const [linkEnrollment] = useLinkAdmissionEnrollmentMutation();
  const [step, setStep] = useState(0);
  const [prefilled, setPrefilled] = useState(!applicationId);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Identity
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [lin, setLin] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("Ugandan");
  const [religion, setReligion] = useState("");

  // Placement
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [residence, setResidence] = useState("");
  const [house, setHouse] = useState("");
  const [hostelId, setHostelId] = useState("");
  const [hostelRoomId, setHostelRoomId] = useState("");
  const [admissionDate, setAdmissionDate] = useState(today);
  const [previousSchool, setPreviousSchool] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [village, setVillage] = useState("");
  const [district, setDistrict] = useState("");

  // Guardians
  const [guardians, setGuardians] = useState<GuardianDraft[]>([newGuardian(true)]);

  // Health
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [disabilities, setDisabilities] = useState("");
  const [emergencyNotes, setEmergencyNotes] = useState("");

  const selectedClass = classes.find((c) => c.id === classId);
  const streams = useMemo(
    () => selectedClass?.streams.filter((s) => s.is_active) ?? [],
    [selectedClass],
  );

  const showHostel = hostelEnabled && residence === "boarder";
  const { data: hostelOptions = [] } = useHostelOptionsQuery(
    { gender: gender || undefined },
    { skip: !showHostel },
  );
  const selectedHostel = hostelOptions.find((h) => h.id === hostelId);
  const hostelRooms = selectedHostel?.rooms ?? [];

  const validationInput = useMemo(
    () => ({
      firstName,
      lastName,
      gender,
      dob,
      nationality,
      classId,
      streamId,
      streamCount: streams.length,
      residence,
      admissionDate,
      homeAddress,
      village,
      district,
      guardians,
      bloodGroup,
    }),
    [
      firstName,
      lastName,
      gender,
      dob,
      nationality,
      classId,
      streamId,
      streams.length,
      residence,
      admissionDate,
      homeAddress,
      village,
      district,
      guardians,
      bloodGroup,
    ],
  );

  function onboardingError(forStep = step) {
    return validateOnboardingStep(forStep, validationInput);
  }

  useEffect(() => {
    if (!application || prefilled) return;
    setFirstName(application.first_name);
    setMiddleName(application.middle_name ?? "");
    setLastName(application.last_name);
    setGender(application.gender ?? "");
    setDob(application.date_of_birth ?? "");
    setClassId(application.applied_class_id ?? "");
    setStreamId(application.applied_stream_id ?? "");
    setPreviousSchool(application.previous_school ?? "");
    if (application.guardian_name) {
      setGuardians([
        {
          relationship: application.guardian_relationship ?? "guardian",
          full_name: application.guardian_name,
          phone_primary: application.guardian_phone ?? "",
          email: application.guardian_email ?? "",
          occupation: "",
          national_id: "",
          is_primary: true,
          is_emergency: true,
          can_pickup: true,
        },
      ]);
    }
    setPrefilled(true);
  }, [application, prefilled]);

  if (applicationId && loadingApplication) return <PageLoader />;
  if (applicationId && application && application.status !== "accepted") {
    return (
      <Card className="p-6">
        <p className="text-[12px] text-slate-600">
          This application must be in the <strong>Accepted</strong> stage before enrollment.
        </p>
        <Link href="/app/m/admissions" className="mt-3 inline-block text-[11px] font-medium text-brand-700">
          Back to pipeline
        </Link>
      </Card>
    );
  }

  function updateGuardian(idx: number, patch: Partial<GuardianDraft>) {
    setGuardians((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }

  function setPrimary(idx: number) {
    setGuardians((prev) => prev.map((g, i) => ({ ...g, is_primary: i === idx })));
  }

  function next() {
    const message = onboardingError();
    if (message) {
      toast(message, "error");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    for (let i = 0; i < STEPS.length - 1; i += 1) {
      const message = validateOnboardingStep(i, validationInput);
      if (message) {
        toast(message, "error");
        setStep(i);
        return;
      }
    }

    const cleanGuardians = guardians
      .filter((g) => g.full_name.trim())
      .map((g) => ({
        relationship: g.relationship,
        full_name: g.full_name.trim(),
        phone_primary: g.phone_primary.trim() || undefined,
        email: g.email.trim() || undefined,
        occupation: g.occupation.trim() || undefined,
        national_id: g.national_id.trim() || undefined,
        is_primary: g.is_primary,
        is_emergency: g.is_emergency,
        can_pickup: g.can_pickup,
      }));

    const healthFields = {
      blood_group: bloodGroup,
      allergies: allergies.trim() || undefined,
      chronic_conditions: conditions.trim() || undefined,
      medications: medications.trim() || undefined,
      disabilities: disabilities.trim() || undefined,
      emergency_notes: emergencyNotes.trim() || undefined,
    };

    try {
      const created = await createStudent({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || undefined,
        last_name: lastName.trim(),
        preferred_name: preferredName.trim() || undefined,
        lin: lin.trim() || undefined,
        gender,
        date_of_birth: dob,
        nationality: nationality.trim(),
        religion: religion.trim() || undefined,
        residence,
        house: house.trim() || undefined,
        hostel_id: showHostel && hostelId ? hostelId : undefined,
        hostel_room_id: showHostel && hostelId && hostelRoomId ? hostelRoomId : undefined,
        admission_date: admissionDate,
        previous_school: previousSchool.trim() || undefined,
        home_address: homeAddress.trim() || undefined,
        village: village.trim() || undefined,
        district: isUgandanNationality(nationality) ? district.trim() : undefined,
        class_id: classId,
        stream_id: streamId || undefined,
        guardians: cleanGuardians,
        health: healthFields,
      }).unwrap();
      if (applicationId) {
        await linkEnrollment({ applicationId, studentId: created.id }).unwrap();
      }
      let successMessage = applicationId
        ? `${created.first_name} ${created.last_name} enrolled from application.`
        : `${created.first_name} ${created.last_name} enrolled.`;
      if (created.portal_account) {
        const emailed =
          created.portal_account.emails_sent && created.portal_account.emails_sent > 0
            ? ` Credentials emailed to ${created.portal_account.emails_sent} guardian(s).`
            : " Share the portal password securely with all guardians.";
        successMessage += ` Portal login ${created.portal_account.username} created.${emailed}`;
      }
      toast(successMessage, "success");
      router.push(`/app/m/students/${created.id}`);
    } catch (err) {
      const p = parseError(err);
      toast(p.message, "error", p.requestId);
    }
  }

  return (
    <Card>
      <CardHeader
        title={applicationId ? "Enroll applicant" : "Enroll student"}
        description={
          application
            ? `Complete enrollment for ${application.reference_number} — ${application.first_name} ${application.last_name}.`
            : "Capture a full learner profile in a few steps."
        }
        action={
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="text-[11px] font-medium text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
        }
      />
      <CardBody className="space-y-4 py-3">
        {/* Stepper */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => i <= step && setStep(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] transition-colors",
                i === step
                  ? "bg-brand-50 font-medium text-brand-700 ring-1 ring-brand-200"
                  : i < step
                    ? "text-slate-500 hover:text-slate-700"
                    : "text-slate-300",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold",
                  i <= step ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500",
                )}
              >
                {i + 1}
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* Step 1: Identity */}
        {step === 0 && (
          <div className="space-y-3">
            <SettingsHint>
              {parentPortalEnabled
                ? "The student number is generated on save and becomes the shared guardian portal username. A portal login is created automatically when you add at least one guardian."
                : "The student number is generated automatically on save (unique per school). Guardian portal logins require the Parent Portal module under Settings → Modules."}
            </SettingsHint>
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
              <FormField label="Preferred name">
                <Input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="LIN">
                <Input value={lin} onChange={(e) => setLin(e.target.value)} placeholder="Optional" className={compactControl} />
              </FormField>
              <FormField label="Gender" required>
                <Select value={gender} onChange={(e) => setGender(e.target.value)} className={compactControl}>
                  <option value="">—</option>
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Date of birth" required>
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="Nationality" required>
                <NationalityField
                  value={nationality}
                  onChange={(value) => {
                    setNationality(value);
                    if (!isUgandanNationality(value)) setDistrict("");
                  }}
                  className={compactControl}
                />
              </FormField>
              <FormField label="Religion">
                <ReligionField
                  value={religion}
                  onChange={setReligion}
                  className={compactControl}
                />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 2: Placement */}
        {step === 1 && (
          <div className="space-y-3">
            {classes.length === 0 && (
              <SettingsHint>
                Set up classes under Settings before enrolling learners.
              </SettingsHint>
            )}
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Class" required>
                <Select
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setStreamId("");
                  }}
                  className={compactControl}
                >
                  <option value="">Choose class…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.level} · {c.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Stream" required={streams.length > 0}>
                <Select
                  value={streamId}
                  onChange={(e) => setStreamId(e.target.value)}
                  className={compactControl}
                  disabled={streams.length === 0}
                >
                  <option value="">{streams.length > 0 ? "Choose stream…" : "—"}</option>
                  {streams.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Residence" required>
                <Select
                  value={residence}
                  onChange={(e) => {
                    setResidence(e.target.value);
                    if (e.target.value !== "boarder") {
                      setHostelId("");
                      setHostelRoomId("");
                    }
                  }}
                  className={compactControl}
                >
                  <option value="">—</option>
                  {RESIDENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </FormField>
              {showHostel ? (
                <>
                  <FormField
                    label="Hostel / dormitory"
                    hint={
                      gender
                        ? "Only hostels matching the learner's gender are listed."
                        : "Set gender to filter compatible hostels."
                    }
                  >
                    <Select
                      value={hostelId}
                      onChange={(e) => {
                        setHostelId(e.target.value);
                        setHostelRoomId("");
                      }}
                      className={compactControl}
                    >
                      <option value="">Assign later…</option>
                      {hostelOptions.map((h) => (
                        <option key={h.id} value={h.id} disabled={h.is_full}>
                          {h.name}
                          {h.available != null ? ` (${h.available} free)` : ""}
                          {h.is_full ? " — full" : ""}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Room" hint={hostelId ? undefined : "Choose a hostel first."}>
                    <Select
                      value={hostelRoomId}
                      onChange={(e) => setHostelRoomId(e.target.value)}
                      className={compactControl}
                      disabled={!hostelId || hostelRooms.length === 0}
                    >
                      <option value="">
                        {hostelRooms.length > 0 ? "No specific room" : "—"}
                      </option>
                      {hostelRooms.map((room) => (
                        <option key={room.id} value={room.id} disabled={room.is_full}>
                          {room.name}
                          {room.capacity ? ` (${room.available} free)` : ""}
                          {room.is_full ? " — full" : ""}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </>
              ) : (
                <FormField label="House">
                  <Input value={house} onChange={(e) => setHouse(e.target.value)} className={compactControl} />
                </FormField>
              )}
              <FormField label="Admission date" required>
                <Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="Previous school">
                <Input value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="Home address" hint="Required if village is not provided.">
                <Input value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="Village" hint="Required if home address is not provided.">
                <Input value={village} onChange={(e) => setVillage(e.target.value)} className={compactControl} />
              </FormField>
              <DistrictField
                nationality={nationality}
                value={district}
                onChange={setDistrict}
                className={compactControl}
              />
            </div>
          </div>
        )}

        {/* Step 3: Guardians */}
        {step === 2 && (
          <div className="space-y-3">
            <SettingsHint>At least one parent or guardian with a phone number is required.</SettingsHint>
            {guardians.map((g, idx) => (
              <div key={idx} className="space-y-2.5 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-700">Guardian {idx + 1}</p>
                  {guardians.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setGuardians((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-[11px] text-slate-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Relationship">
                    <Select
                      value={g.relationship}
                      onChange={(e) => updateGuardian(idx, { relationship: e.target.value })}
                      className={compactControl}
                    >
                      {RELATIONSHIP_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Full name" required>
                    <Input value={g.full_name} onChange={(e) => updateGuardian(idx, { full_name: e.target.value })} className={compactControl} />
                  </FormField>
                  <FormField label="Phone" required={g.is_primary}>
                    <Input value={g.phone_primary} onChange={(e) => updateGuardian(idx, { phone_primary: e.target.value })} className={compactControl} placeholder="+256…" />
                  </FormField>
                  <FormField label="Email">
                    <Input value={g.email} onChange={(e) => updateGuardian(idx, { email: e.target.value })} className={compactControl} />
                  </FormField>
                  <FormField label="Occupation">
                    <Input value={g.occupation} onChange={(e) => updateGuardian(idx, { occupation: e.target.value })} className={compactControl} />
                  </FormField>
                  <FormField label="National ID (NIN)">
                    <Input value={g.national_id} onChange={(e) => updateGuardian(idx, { national_id: e.target.value })} className={compactControl} />
                  </FormField>
                </div>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input
                      type="radio"
                      name="primary-guardian"
                      checked={g.is_primary}
                      onChange={() => setPrimary(idx)}
                      className="border-slate-300"
                    />
                    Primary
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={g.is_emergency}
                      onChange={(e) => updateGuardian(idx, { is_emergency: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Emergency
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={g.can_pickup}
                      onChange={(e) => updateGuardian(idx, { can_pickup: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Can pick up
                  </label>
                </div>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setGuardians((prev) => [...prev, newGuardian(false)])}>
              <Icon name="plus" size={12} />
              Add another guardian
            </Button>
          </div>
        )}

        {/* Step 4: Health */}
        {step === 3 && (
          <div className="space-y-3">
            <SettingsHint>Blood group is required. Add allergies and other notes when known.</SettingsHint>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <FormField label="Blood group" required>
                <Select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className={compactControl}>
                  <option value="">—</option>
                  {BLOOD_GROUP_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Allergies">
                <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="Chronic conditions">
                <Input value={conditions} onChange={(e) => setConditions(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="Medications">
                <Input value={medications} onChange={(e) => setMedications(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="Disabilities / special needs">
                <Input value={disabilities} onChange={(e) => setDisabilities(e.target.value)} className={compactControl} />
              </FormField>
              <FormField label="Emergency notes">
                <Input value={emergencyNotes} onChange={(e) => setEmergencyNotes(e.target.value)} className={compactControl} />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-[12px] text-slate-600">
              <p className="text-[13px] font-semibold text-slate-800">
                {formatStudentFullName({ first_name: firstName, middle_name: middleName, last_name: lastName })}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Student number assigned automatically on save
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                <div><dt className="text-[10px] text-slate-400">Class</dt><dd>{selectedClass ? `${selectedClass.level} · ${selectedClass.label}` : "Unassigned"}</dd></div>
                <div><dt className="text-[10px] text-slate-400">Residence</dt><dd>{residence || "—"}</dd></div>
                <div><dt className="text-[10px] text-slate-400">Guardians</dt><dd>{guardians.filter((g) => g.full_name.trim()).length}</dd></div>
                <div><dt className="text-[10px] text-slate-400">Blood group</dt><dd>{bloodGroup || "—"}</dd></div>
                <div><dt className="text-[10px] text-slate-400">Gender</dt><dd>{gender || "—"}</dd></div>
                <div><dt className="text-[10px] text-slate-400">DOB</dt><dd>{dob || "—"}</dd></div>
              </dl>
            </div>
            <SettingsHint>Review the details above, then confirm to create the learner profile.</SettingsHint>
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <Button size="sm" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button size="sm" loading={isLoading} onClick={() => void submit()}>
              Create student
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
