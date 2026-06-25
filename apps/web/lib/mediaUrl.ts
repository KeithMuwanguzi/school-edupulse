import { API_URL } from "@/lib/apiConfig";

/** Resolve API-relative media paths (e.g. school badge) for img src. */
export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const apiOrigin = API_URL.replace(/\/api\/v1\/?$/, "");
  return `${apiOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}
