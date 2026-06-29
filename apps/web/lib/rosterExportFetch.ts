import { API_URL } from "@/lib/apiConfig";
import type {
  CursorPage,
  RegistrationQueueItemOut,
  RegisteredStudentOut,
  StudentOut,
} from "@/lib/types";

function authHeaders(accessToken: string | null | undefined): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function tenantGet<T>(path: string, accessToken: string | null | undefined): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders(accessToken) });
  if (!res.ok) throw new Error("Request failed");
  return res.json() as Promise<T>;
}

export async function fetchAllStudents(
  accessToken: string | null | undefined,
  params: {
    classId?: string;
    streamId?: string;
    unassigned?: boolean;
    q?: string;
  },
): Promise<StudentOut[]> {
  const items: StudentOut[] = [];
  let cursor: string | undefined;

  for (;;) {
    const p = new URLSearchParams();
    if (cursor) p.set("cursor", cursor);
    p.set("limit", "100");
    if (params.classId) p.set("class_id", params.classId);
    if (params.streamId) p.set("stream_id", params.streamId);
    if (params.unassigned) p.set("unassigned", "true");
    if (params.q) p.set("q", params.q);

    const page = await tenantGet<CursorPage<StudentOut>>(`/tenant/students?${p}`, accessToken);
    items.push(...page.items);
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }

  return items;
}

export async function fetchRegistrationQueue(
  accessToken: string | null | undefined,
  params: {
  termId?: string;
  status?: string;
  q?: string;
  classId?: string;
  streamId?: string;
  unassigned?: boolean;
}): Promise<RegistrationQueueItemOut[]> {
  const p = new URLSearchParams();
  if (params.termId) p.set("term_id", params.termId);
  if (params.status) p.set("status", params.status);
  if (params.q) p.set("q", params.q);
  if (params.classId) p.set("class_id", params.classId);
  if (params.streamId) p.set("stream_id", params.streamId);
  if (params.unassigned) p.set("unassigned", "true");
  const qs = p.toString();
  return tenantGet<RegistrationQueueItemOut[]>(
    `/tenant/registration/queue${qs ? `?${qs}` : ""}`,
    accessToken,
  );
}

export async function fetchRegisteredRoster(
  accessToken: string | null | undefined,
  params: {
  termId?: string;
  q?: string;
  classId?: string;
  streamId?: string;
  unassigned?: boolean;
}): Promise<RegisteredStudentOut[]> {
  const p = new URLSearchParams();
  if (params.termId) p.set("term_id", params.termId);
  if (params.q) p.set("q", params.q);
  if (params.classId) p.set("class_id", params.classId);
  if (params.streamId) p.set("stream_id", params.streamId);
  if (params.unassigned) p.set("unassigned", "true");
  p.set("limit", "500");
  const qs = p.toString();
  return tenantGet<RegisteredStudentOut[]>(`/tenant/registration/roster?${qs}`, accessToken);
}
