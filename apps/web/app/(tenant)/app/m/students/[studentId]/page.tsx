"use client";

import { useParams } from "next/navigation";
import { StudentDetailView } from "@/components/domain/students/StudentDetailView";

export default function StudentDetailPage() {
  const params = useParams<{ studentId: string }>();
  return <StudentDetailView studentId={params.studentId} />;
}
