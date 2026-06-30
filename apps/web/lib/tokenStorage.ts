// Refresh tokens are HttpOnly cookies set by the API (§12 XSS hygiene).
// The access token lives only in Redux memory.

const LEGACY_REFRESH_KEY = "skulpulse.refresh";

export const tokenStorage = {
  /** Remove legacy localStorage refresh tokens from Phase 1. */
  clearLegacyRefresh(): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LEGACY_REFRESH_KEY);
  },
};

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
