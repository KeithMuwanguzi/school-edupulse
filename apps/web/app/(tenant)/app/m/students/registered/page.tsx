"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentsRegisteredRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/m/students/term?tab=completed");
  }, [router]);
  return null;
}
