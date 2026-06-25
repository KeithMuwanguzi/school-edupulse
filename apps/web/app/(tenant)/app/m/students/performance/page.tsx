"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentsPerformanceRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/m/students");
  }, [router]);
  return null;
}
