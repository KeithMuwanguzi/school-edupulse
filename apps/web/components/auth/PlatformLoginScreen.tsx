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
import { useLazyGetMeQuery, usePlatformLoginMutation } from "@/store/api/skulpulseApi";

/** Unlisted platform console sign-in — not linked from public school-facing pages. */
export function PlatformLoginScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = usePlatformLoginMutation();
  const [fetchMe] = useLazyGetMeQuery();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ParsedError | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const tokens = await login({ email, password }).unwrap();
      tokenStorage.setRefresh(tokens.refresh_token);
      dispatch(setAccessToken(tokens.access_token));
      const me = await fetchMe().unwrap();
      dispatch(setUser(me));
      router.replace("/admin");
    } catch (err) {
      setError(parseError(err));
    }
  }

  return (
    <AuthShell
      variant="platform"
      eyebrow="Platform console"
      title="Internal sign in"
      subtitle="Authorized SkulPulse staff only. School users should use the school portal."
      sideTitle="Platform operations"
      sideBody="Onboard schools, manage module subscriptions, and review request trails across tenants."
      sideItems={[
        "Multi-tenant school onboarding",
        "Module catalog and billing estimates",
        "Audit and API request logs",
      ]}
      watermark="ADMIN"
      footer={
        <p className="text-center text-[10px] leading-relaxed text-slate-400">
          This URL is not published on the public site.
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3.5">
        {error && (
          <ErrorBanner compact message={error.message} requestId={error.requestId} />
        )}

        <AuthField label="Email" htmlFor="email">
          <AuthInput
            id="email"
            type="email"
            autoComplete="username"
            placeholder="admin@skulpulse.ug"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
