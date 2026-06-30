"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Icon } from "@/components/ui/Icon";
import { parseError } from "@/lib/apiError";
import { useAppDispatch } from "@/store/hooks";
import { setAccessToken, setUser } from "@/store/slices/authSlice";
import {
  useChangePasswordMutation,
  useChangePlatformPasswordMutation,
  useLazyGetMeQuery,
} from "@/store/api/skulpulseApi";

type PortalKind = "tenant" | "platform";

export function ChangePasswordGate({
  userName,
  portal = "tenant",
}: {
  userName: string;
  portal?: PortalKind;
}) {
  const dispatch = useAppDispatch();
  const [changeTenantPassword, { isLoading: tenantLoading }] = useChangePasswordMutation();
  const [changePlatformPassword, { isLoading: platformLoading }] =
    useChangePlatformPasswordMutation();
  const [fetchMe] = useLazyGetMeQuery();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isLoading = portal === "platform" ? platformLoading : tenantLoading;
  const subtitle =
    portal === "platform"
      ? `Welcome, ${userName}. Choose a personal password before continuing to the platform console.`
      : `Welcome, ${userName}. For your security, choose a personal password before continuing to your school portal.`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    try {
      const change =
        portal === "platform" ? changePlatformPassword : changeTenantPassword;
      const tokens = await change({
        current_password: current,
        new_password: next,
      }).unwrap();
      dispatch(setAccessToken(tokens.access_token));
      const me = await fetchMe().unwrap();
      dispatch(setUser(me));
    } catch (err) {
      setError(parseError(err).message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div aria-hidden className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_32px_80px_-24px_rgba(15,40,36,0.55)]">
        <div className="bg-brand-700 px-6 py-5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300">
            Security check
          </p>
          <h2 id="change-password-title" className="mt-1 font-display text-[1.35rem] font-medium">
            Set your new password
          </h2>
          <p className="mt-2 text-[12px] leading-relaxed text-brand-100">{subtitle}</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              {error}
            </p>
          )}
          <FormField label="Current password" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </FormField>
          <FormField label="New password" hint="Minimum 8 characters" required>
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Confirm new password" required>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </FormField>
          <Button type="submit" className="w-full" variant="accent" loading={isLoading}>
            Save and continue
            <Icon name="arrow-right" size={14} />
          </Button>
        </form>
      </div>
    </div>
  );
}
