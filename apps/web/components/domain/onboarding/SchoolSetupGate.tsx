"use client";

import {
  SchoolSetupExperience,
  SchoolSetupFloatingReminder,
} from "@/components/domain/onboarding/SchoolSetupExperience";
import { useSchoolSetup } from "@/hooks/useSchoolSetup";

interface Props {
  enabled: boolean;
}

export function SchoolSetupGate({ enabled }: Props) {
  const {
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
  } = useSchoolSetup(enabled);

  if (!enabled || !evaluation || !school) return null;

  return (
    <>
      {showGate && (
        <SchoolSetupExperience
          evaluation={evaluation}
          schoolName={school.profile.name}
          schoolCode={schoolCode}
          badgeUrl={school.profile.badge_url}
          onSkipStep={skipStep}
          onSkipAllOptional={skipAllOptional}
          onEnterWorkingMode={enterWorkingMode}
          onCelebrated={() => setCelebrated(true)}
        />
      )}
      {showFloatingReminder && (
        <SchoolSetupFloatingReminder evaluation={evaluation} onReopen={exitWorkingMode} />
      )}
    </>
  );
}
