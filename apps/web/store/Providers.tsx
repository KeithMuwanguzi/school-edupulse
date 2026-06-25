"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { store } from "./index";
import { setAccessToken, setAnonymous, setUser } from "./slices/authSlice";
import { API_URL } from "@/lib/apiConfig";
import { tokenStorage } from "@/lib/tokenStorage";
import type { Me, TokenResponse } from "@/lib/types";
import { ToastProvider } from "@/components/ui/Toast";

/** Restore a session on load by rotating the stored refresh token (§7.3). */
let bootstrapInFlight: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  if (bootstrapInFlight) return bootstrapInFlight;

  bootstrapInFlight = (async () => {
    const refresh = tokenStorage.getRefresh();
    if (!refresh) {
      store.dispatch(setAnonymous());
      return;
    }
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) throw new Error("refresh failed");
      const tokens = (await res.json()) as TokenResponse;
      tokenStorage.setRefresh(tokens.refresh_token);
      store.dispatch(setAccessToken(tokens.access_token));

      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!meRes.ok) throw new Error("me failed");
      store.dispatch(setUser((await meRes.json()) as Me));
    } catch {
      tokenStorage.clear();
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
      <ToastProvider>{ready ? children : null}</ToastProvider>
    </Provider>
  );
}
