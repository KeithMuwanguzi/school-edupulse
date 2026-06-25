"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui/Spinner";

export default function SettingsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/settings/profile");
  }, [router]);

  return <PageLoader />;
}
