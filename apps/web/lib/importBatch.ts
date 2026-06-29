import type { ImportUsersResponse, StudentImportResponse } from "@/lib/types";

export const STUDENT_IMPORT_BATCH_SIZE = 50;
export const TEACHER_IMPORT_BATCH_SIZE = 25;

export function chunkRows<T>(rows: T[], size: number): T[][] {
  if (size <= 0) return [rows];
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

export function mergeStudentImportResponses(
  responses: StudentImportResponse[],
): StudentImportResponse {
  return responses.reduce<StudentImportResponse>(
    (acc, r) => ({
      created: acc.created + r.created,
      skipped: acc.skipped + r.skipped,
      failed: acc.failed + r.failed,
      valid: acc.valid + r.valid,
      results: [...acc.results, ...r.results],
    }),
    { created: 0, skipped: 0, failed: 0, valid: 0, results: [] },
  );
}

export function mergeUserImportResponses(responses: ImportUsersResponse[]): ImportUsersResponse {
  return responses.reduce<ImportUsersResponse>(
    (acc, r) => ({
      created: acc.created + r.created,
      skipped: acc.skipped + r.skipped,
      failed: acc.failed + r.failed,
      results: [...acc.results, ...r.results],
    }),
    { created: 0, skipped: 0, failed: 0, results: [] },
  );
}

export type ImportProgressCallback = (done: number, total: number, phase: string) => void;

export async function runStudentImportBatches<T>(
  rows: T[],
  batchSize: number,
  phase: string,
  importBatch: (batch: T[], lineOffset: number) => Promise<StudentImportResponse>,
  onProgress: ImportProgressCallback,
): Promise<StudentImportResponse> {
  const chunks = chunkRows(rows, batchSize);
  const total = rows.length;
  let done = 0;
  const responses: StudentImportResponse[] = [];
  onProgress(0, total, phase);
  for (const chunk of chunks) {
    const res = await importBatch(chunk, done);
    responses.push(res);
    done += chunk.length;
    onProgress(done, total, phase);
  }
  return mergeStudentImportResponses(responses);
}

export async function runUserImportBatches<T>(
  rows: T[],
  batchSize: number,
  phase: string,
  importBatch: (batch: T[], lineOffset: number) => Promise<ImportUsersResponse>,
  onProgress: ImportProgressCallback,
): Promise<ImportUsersResponse> {
  const chunks = chunkRows(rows, batchSize);
  const total = rows.length;
  let done = 0;
  const responses: ImportUsersResponse[] = [];
  onProgress(0, total, phase);
  for (const chunk of chunks) {
    const res = await importBatch(chunk, done);
    responses.push(res);
    done += chunk.length;
    onProgress(done, total, phase);
  }
  return mergeUserImportResponses(responses);
}
