import { API_URL } from "@/lib/apiConfig";

export async function downloadAuditExport(
  format: "csv" | "json",
  accessToken?: string | null,
) {
  const url = `${API_URL}/platform/logs/audit/export?format=${format}`;
  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `audit-trail-${stamp}.${format}`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function downloadAuditFile(relativePath: string, accessToken?: string | null) {
  const url = `${API_URL}/platform/logs/files/download?path=${encodeURIComponent(relativePath)}`;
  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = relativePath.split("/").pop() ?? "audit.jsonl";
  a.click();
  URL.revokeObjectURL(a.href);
}
