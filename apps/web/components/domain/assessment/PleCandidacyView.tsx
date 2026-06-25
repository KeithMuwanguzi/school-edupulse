"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatStudentFullName } from "@/components/domain/students/studentOptions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/Spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { parseError } from "@/lib/apiError";
import type { PleCandidateOut } from "@/lib/types";
import {
  useNominatePleCandidatesMutation,
  usePleCandidatesQuery,
  usePleEligibleQuery,
  usePleSummaryQuery,
  useUpdatePleCandidateMutation,
} from "@/store/api/skulpulseApi";
import { useAppSelector } from "@/store/hooks";

const STATUS_TONE: Record<string, "green" | "amber" | "blue" | "neutral" | "red"> = {
  nominated: "amber",
  registered: "green",
  withdrawn: "red",
  completed: "blue",
};

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ReadinessCells({ readiness }: { readiness: PleCandidateOut["readiness"] }) {
  if (!readiness.marks_available) {
    return (
      <>
        <TD className="text-slate-400">—</TD>
        <TD className="text-slate-400">—</TD>
        <TD className="text-slate-400">—</TD>
      </>
    );
  }
  return (
    <>
      <TD className="tabular-nums">{readiness.average_score ?? "—"}</TD>
      <TD className="tabular-nums">{readiness.aggregate ?? "—"}</TD>
      <TD>{readiness.division_label ?? "—"}</TD>
    </>
  );
}

export function PleCandidacyView() {
  const user = useAppSelector((s) => s.auth.user);
  const isAdmin = user?.role === "school_admin" || user?.role === "deputy_head";
  const { toast } = useToast();
  const [selectedEligible, setSelectedEligible] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [candidateNumber, setCandidateNumber] = useState("");

  const { data: summary, isLoading: summaryLoading } = usePleSummaryQuery();
  const {
    data: candidates = [],
    isLoading: candidatesLoading,
    isError: candidatesError,
    error: candidatesErr,
  } = usePleCandidatesQuery();
  const { data: eligible = [], isLoading: eligibleLoading } = usePleEligibleQuery();
  const [nominate, { isLoading: nominating }] = useNominatePleCandidatesMutation();
  const [updateCandidate, { isLoading: updating }] = useUpdatePleCandidateMutation();

  const allEligibleSelected = useMemo(
    () => eligible.length > 0 && eligible.every((s) => selectedEligible.has(s.student_id)),
    [eligible, selectedEligible],
  );

  if (summaryLoading) return <PageLoader />;

  async function handleNominate() {
    if (!selectedEligible.size) return;
    try {
      await nominate({ studentIds: [...selectedEligible] }).unwrap();
      setSelectedEligible(new Set());
      toast("P7 learners nominated as PLE candidates.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  async function handleRegister(candidate: PleCandidateOut) {
    try {
      await updateCandidate({
        candidateId: candidate.id,
        body: {
          status: "registered",
          candidate_number: candidateNumber.trim() || undefined,
        },
      }).unwrap();
      setEditingId(null);
      setCandidateNumber("");
      toast("Candidate registered for PLE.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  async function handleWithdraw(candidateId: string) {
    try {
      await updateCandidate({
        candidateId,
        body: { status: "withdrawn", withdrawal_reason: "Withdrawn by school" },
      }).unwrap();
      toast("Candidate withdrawn.", "success");
    } catch (err) {
      toast(parseError(err).message, "error");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Assessment"
        title="P7 PLE candidacy"
        description="Nominate registered P7 learners, track UNEB registration, and monitor readiness from current-term assessment results."
      />

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <SummaryStat label="P7 registered" value={summary.total_p7_registered} />
          <SummaryStat label="Not nominated" value={summary.not_nominated} />
          <SummaryStat label="Nominated" value={summary.nominated} />
          <SummaryStat label="Registered" value={summary.registered} />
          <SummaryStat label="Withdrawn" value={summary.withdrawn} />
          <SummaryStat label="Completed" value={summary.completed} />
          <SummaryStat
            label="Year · term"
            value={`${summary.academic_year_label}${summary.term_label ? ` · ${summary.term_label}` : ""}`}
          />
        </div>
      ) : null}

      {isAdmin && eligible.length > 0 ? (
        <Card>
          <CardHeader
            title="Eligible P7 learners"
            description="Fully registered P7 pupils not yet nominated for this academic year."
            action={
              <Button
                size="sm"
                onClick={handleNominate}
                disabled={!selectedEligible.size || nominating}
              >
                Nominate selected ({selectedEligible.size})
              </Button>
            }
          />
          <CardBody className="overflow-x-auto py-0">
            {eligibleLoading ? (
              <PageLoader />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH className="w-10">
                      <input
                        type="checkbox"
                        checked={allEligibleSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEligible(new Set(eligible.map((s) => s.student_id)));
                          } else {
                            setSelectedEligible(new Set());
                          }
                        }}
                      />
                    </TH>
                    <TH>Pupil</TH>
                    <TH>Class</TH>
                    <TH>Avg %</TH>
                    <TH>Aggregate</TH>
                    <TH>Division</TH>
                  </TR>
                </THead>
                <TBody>
                  {eligible.map((row) => {
                    const name = formatStudentFullName({
                      last_name: row.last_name,
                      middle_name: row.middle_name,
                      first_name: row.first_name,
                    });
                    return (
                      <TR key={row.student_id}>
                        <TD>
                          <input
                            type="checkbox"
                            checked={selectedEligible.has(row.student_id)}
                            onChange={(e) => {
                              const next = new Set(selectedEligible);
                              if (e.target.checked) next.add(row.student_id);
                              else next.delete(row.student_id);
                              setSelectedEligible(next);
                            }}
                          />
                        </TD>
                        <TD>
                          <Link
                            href={`/app/m/students/${row.student_id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {name}
                          </Link>
                          <p className="font-mono text-[10px] text-slate-400">{row.student_number}</p>
                        </TD>
                        <TD>{[row.class_label, row.stream_name].filter(Boolean).join(" · ") || "—"}</TD>
                        <ReadinessCells readiness={row.readiness} />
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="PLE candidates"
          description="Track nomination, UNEB registration numbers, and readiness for the November exam."
        />
        <CardBody className="overflow-x-auto py-0">
          {candidatesLoading ? (
            <PageLoader />
          ) : candidatesError ? (
            <ErrorBanner message={parseError(candidatesErr).message} />
          ) : !candidates.length ? (
            <EmptyState
              title="No PLE candidates yet"
              description={
                summary?.total_p7_registered
                  ? "Nominate registered P7 learners above to begin tracking candidacy."
                  : "Assign learners to P7 and complete term registration first."
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Pupil</TH>
                  <TH>Status</TH>
                  <TH>UNEB no.</TH>
                  <TH>Avg %</TH>
                  <TH>Aggregate</TH>
                  <TH>Division</TH>
                  {isAdmin ? <TH>Actions</TH> : null}
                </TR>
              </THead>
              <TBody>
                {candidates.map((row) => {
                  const name = formatStudentFullName({
                    last_name: row.student.last_name,
                    middle_name: row.student.middle_name,
                    first_name: row.student.first_name,
                  });
                  const editing = editingId === row.id;
                  return (
                    <TR key={row.id}>
                      <TD>
                        <Link
                          href={`/app/m/students/${row.student_id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {name}
                        </Link>
                        <p className="text-[10px] text-slate-500">
                          {[row.student.class_label, row.student.stream_name]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </TD>
                      <TD>
                        <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{row.status}</Badge>
                      </TD>
                      <TD>
                        {editing ? (
                          <Input
                            value={candidateNumber}
                            onChange={(e) => setCandidateNumber(e.target.value)}
                            placeholder="UNEB index"
                            className="h-7 text-[12px]"
                          />
                        ) : (
                          row.candidate_number ?? "—"
                        )}
                      </TD>
                      <ReadinessCells readiness={row.readiness} />
                      {isAdmin ? (
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            {row.status === "nominated" ? (
                              editing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleRegister(row)}
                                    disabled={updating}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setEditingId(null);
                                      setCandidateNumber("");
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setEditingId(row.id);
                                    setCandidateNumber(row.candidate_number ?? "");
                                  }}
                                >
                                  Register
                                </Button>
                              )
                            ) : null}
                            {row.status === "registered" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleWithdraw(row.id)}
                                disabled={updating}
                              >
                                Withdraw
                              </Button>
                            ) : null}
                          </div>
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
