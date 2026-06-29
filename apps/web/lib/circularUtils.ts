import { API_URL } from "@/lib/apiConfig";

function authHeaders(accessToken: string | null | undefined): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export async function downloadCircularAttachment(
  circularId: string,
  filename: string,
  accessToken: string | null | undefined,
) {
  const resp = await fetch(`${API_URL}/tenant/circulars/${circularId}/attachment`, {
    headers: authHeaders(accessToken),
  });
  if (!resp.ok) throw new Error("Unable to download attachment.");
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "circular-attachment";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatCircularDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
