"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StudentsRegistrationRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/app/m/students/term");
  }, [router]);
  return null;
}
