// Refresh-token persistence. Phase 1: localStorage (Bearer flow is permitted by
// §3). The access token lives only in Redux memory. Phase 2 should move the
// refresh token to an httpOnly cookie (§12 XSS hygiene).

const REFRESH_KEY = "skulpulse.refresh";

export const tokenStorage = {
  getRefresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  setRefresh(token: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REFRESH_KEY, token);
  },
  clear(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
