"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  evaluateSchoolSetup,
  hasCelebratedSetup,
  isSetupWorkingMode,
  markSetupCelebrated,
  readSkippedStepIds,
  setSetupWorkingMode,
  skipAllOptionalSteps,
  skipSetupStep,
  type SetupEvaluation,
} from "@/lib/schoolSetup";
import {
  useAcademicContextQuery,
  useFeeStructuresQuery,
  useFinanceSummaryQuery,
  useGetGradingConfigQuery,
  useGetRegistrationConfigQuery,
  useGetTenantSchoolQuery,
  useListClassesQuery,
  useListSubjectsQuery,
  useListTenantUsersQuery,
  useRosterSummaryQuery,
} from "@/store/api/skulpulseApi";

export function useSchoolSetup(enabled: boolean) {
  const { data: school } = useGetTenantSchoolQuery(undefined, { skip: !enabled });
  const schoolCode = school?.school_code ?? "";
  const modules = school?.modules ?? [];

  const hasStudents = modules.includes("students");
  const hasFinance = modules.includes("finance");
  const hasGradingModule =
    modules.includes("assessment") || modules.includes("reportcards");

  const { data: academic } = useAcademicContextQuery(undefined, { skip: !enabled });
  const { data: classes } = useListClassesQuery(undefined, { skip: !enabled });
  const { data: subjects } = useListSubjectsQuery(undefined, { skip: !enabled });
  const { data: users } = useListTenantUsersQuery(undefined, { skip: !enabled });
  const { data: roster } = useRosterSummaryQuery(undefined, {
    skip: !enabled || !hasStudents,
  });
  const { data: grading } = useGetGradingConfigQuery(undefined, {
    skip: !enabled || !hasGradingModule,
  });
  const { data: registration } = useGetRegistrationConfigQuery(undefined, {
    skip: !enabled || !hasStudents,
  });
  const { data: financeSummary } = useFinanceSummaryQuery(undefined, {
    skip: !enabled || !hasFinance,
  });
  const { data: feeStructures } = useFeeStructuresQuery(undefined, {
    skip: !enabled || !hasFinance,
  });

  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());
  const [workingMode, setWorkingMode] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    if (!schoolCode) return;
    setSkippedIds(readSkippedStepIds(schoolCode));
    setWorkingMode(isSetupWorkingMode(schoolCode));
    setCelebrated(hasCelebratedSetup(schoolCode));
  }, [schoolCode]);

  const evaluation: SetupEvaluation | null = useMemo(() => {
    if (!enabled || !school) return null;
    return evaluateSchoolSetup({
      modules,
      skippedIds,
      school,
      academic,
      classes,
      subjects,
      users,
      roster,
      grading,
      registration,
      financeSummary,
      feeStructureCount: feeStructures?.length ?? 0,
    });
  }, [
    enabled,
    school,
    modules,
    skippedIds,
    academic,
    classes,
    subjects,
    users,
    roster,
    grading,
    registration,
    financeSummary,
    feeStructures,
  ]);

  useEffect(() => {
    if (!schoolCode || !evaluation?.isComplete || celebrated) return;
    markSetupCelebrated(schoolCode);
    setCelebrated(true);
    setSetupWorkingMode(schoolCode, false);
    setWorkingMode(false);
  }, [schoolCode, evaluation?.isComplete, celebrated]);

  const skipStep = useCallback(
    (stepId: string) => {
      if (!schoolCode) return;
      setSkippedIds(skipSetupStep(schoolCode, stepId));
    },
    [schoolCode],
  );

  const skipAllOptional = useCallback(() => {
    if (!schoolCode || !evaluation) return;
    const ids = evaluation.optional.filter((s) => !s.resolved).map((s) => s.id);
    setSkippedIds(skipAllOptionalSteps(schoolCode, ids));
  }, [schoolCode, evaluation]);

  const enterWorkingMode = useCallback(() => {
    if (!schoolCode) return;
    setSetupWorkingMode(schoolCode, true);
    setWorkingMode(true);
  }, [schoolCode]);

  const exitWorkingMode = useCallback(() => {
    if (!schoolCode) return;
    setSetupWorkingMode(schoolCode, false);
    setWorkingMode(false);
  }, [schoolCode]);

  const showGate =
    enabled &&
    Boolean(evaluation) &&
    !evaluation!.isComplete &&
    !celebrated &&
    !workingMode;

  const showFloatingReminder =
    enabled &&
    Boolean(evaluation) &&
    !evaluation!.isComplete &&
    !celebrated &&
    workingMode;

  return {
    school,
    schoolCode,
    evaluation,
    showGate,
    showFloatingReminder,
    skipStep,
    skipAllOptional,
    enterWorkingMode,
    exitWorkingMode,
    setCelebrated,
  };
}
