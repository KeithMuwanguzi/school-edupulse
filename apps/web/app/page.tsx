"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { TenantLoginScreen } from "@/components/auth/TenantLoginScreen";
import { PageLoader } from "@/components/ui/Spinner";

/** `/` — school portal entry: login when anonymous, else route to the right home. */
export default function HomePage() {
  const router = useRouter();
  const { status, user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(user.type === "platform_admin" ? "/admin" : "/app");
    }
  }, [status, user, router]);

  if (status === "unknown") return <PageLoader />;
  if (status === "authenticated") return <PageLoader />;
  return <TenantLoginScreen />;
}
