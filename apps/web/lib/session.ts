"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearAuth } from "@/store/slices/authSlice";
import { useLogoutMutation } from "@/store/api/skulpulseApi";
import { tokenStorage } from "@/lib/tokenStorage";

/** Redirect to `loginPath` unless the session matches `requiredType`. */
export function useAuthGuard(
  requiredType: "platform_admin" | "tenant_user",
  loginPath: string,
) {
  const router = useRouter();
  const { status, user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (status === "unknown") return;
    if (status === "anonymous") {
      router.replace(loginPath);
    } else if (status === "authenticated" && user && user.type !== requiredType) {
      // Wrong portal for this session — send to the correct home.
      router.replace(user.type === "platform_admin" ? "/admin" : "/app");
    }
  }, [status, user, requiredType, loginPath, router]);

  return {
    ready:
      status === "authenticated" && user?.type === requiredType,
    bootstrapping: status === "unknown",
    user,
  };
}

export function useLogout(loginPath: string) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logout] = useLogoutMutation();

  return async () => {
    const refresh = tokenStorage.getRefresh();
    if (refresh) {
      try {
        await logout({ refresh_token: refresh }).unwrap();
      } catch {
        /* best effort */
      }
    }
    tokenStorage.clear();
    dispatch(clearAuth());
    router.replace(loginPath);
  };
}
