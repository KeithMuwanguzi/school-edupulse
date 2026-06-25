"use client";

import { useParams } from "next/navigation";
import { TermRegistrationWizard } from "@/components/domain/students/TermRegistrationWizard";

export default function StudentRegistrationDetailPage() {
  const params = useParams<{ registrationId: string }>();
  return <TermRegistrationWizard registrationId={params.registrationId} />;
}
