import { redirect } from "next/navigation";

export default function LegacyStudentOnboardingPage() {
  redirect("/app/m/students/enroll");
}
