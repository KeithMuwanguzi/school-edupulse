"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { store } from "./index";
import { setAccessToken, setAnonymous, setUser } from "./slices/authSlice";
import { API_URL } from "@/lib/apiConfig";
import { tokenStorage } from "@/lib/tokenStorage";
import type { Me, TokenResponse } from "@/lib/types";
import { ToastProvider } from "@/components/ui/Toast";
import { DialogProvider } from "@/components/ui/Dialog";

/** Restore a session on load by rotating the HttpOnly refresh cookie (§7.3). */
let bootstrapInFlight: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  if (bootstrapInFlight) return bootstrapInFlight;

  bootstrapInFlight = (async () => {
    tokenStorage.clearLegacyRefresh();
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) throw new Error("refresh failed");
      const tokens = (await res.json()) as TokenResponse;
      store.dispatch(setAccessToken(tokens.access_token));

      const meRes = await fetch(`${API_URL}/auth/me`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!meRes.ok) throw new Error("me failed");
      store.dispatch(setUser((await meRes.json()) as Me));
    } catch {
      store.dispatch(setAnonymous());
    }
  })().finally(() => {
    bootstrapInFlight = null;
  });

  return bootstrapInFlight;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    bootstrap().finally(() => setReady(true));
  }, []);

  return (
    <Provider store={store}>
      <DialogProvider>
        <ToastProvider>{ready ? children : null}</ToastProvider>
      </DialogProvider>
    </Provider>
  );
}
