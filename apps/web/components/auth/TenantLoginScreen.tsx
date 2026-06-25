"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import {
  AuthField,
  AuthInput,
  AuthShell,
  AuthSubmit,
} from "@/components/auth/AuthShell";
import { parseError, ParsedError } from "@/lib/apiError";
import { tokenStorage } from "@/lib/tokenStorage";
import { useAppDispatch } from "@/store/hooks";
import { setAccessToken, setUser } from "@/store/slices/authSlice";
import { useLazyGetMeQuery, useTenantLoginMutation } from "@/store/api/skulpulseApi";

export function TenantLoginScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useTenantLoginMutation();
  const [fetchMe] = useLazyGetMeQuery();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ParsedError | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const tokens = await login({ username, password }).unwrap();
      tokenStorage.setRefresh(tokens.refresh_token);
      dispatch(setAccessToken(tokens.access_token));
      const me = await fetchMe().unwrap();
      dispatch(setUser(me));
      router.replace("/app");
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <AuthShell
      variant="tenant"
      eyebrow="School portal"
      title="Welcome back"
      subtitle="Sign in with your school username to open your portal."
      sideTitle="About SkulPulse"
      sideBody="Modular administration for Ugandan primary schools — subscribe only to the modules you need, per term."
      sideItems={[
        "Secure, isolated data for every school",
        "Profile and module self-service",
        "Built for P1–P7 and MoES term structure",
      ]}
      watermark="PORTAL"
      footer={
        <p className="text-center text-[10px] leading-relaxed text-slate-400">
          Need help? Contact your school administrator.
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3.5">
        {error && (
          <ErrorBanner compact message={error.message} requestId={error.requestId} />
        )}

        {/* <AuthField label="Username" htmlFor="username" hint="e.g. 0001@KAMPPS"> */}
        <AuthField label="Username" htmlFor="username" hint="">
          <AuthInput
            id="username"
            autoComplete="username"
            placeholder="0001@SCHOOLCODE"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </AuthField>

        <AuthField label="Password" htmlFor="password">
          <AuthInput
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </AuthField>

        <AuthSubmit loading={isLoading}>Sign in</AuthSubmit>
      </form>
    </AuthShell>
  );
}
