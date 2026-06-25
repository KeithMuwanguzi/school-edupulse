import type { ProblemDetail } from "./types";
import { API_URL } from "./apiConfig";

export interface ParsedError {
  message: string;
  code?: string;
  requestId?: string;
  fieldErrors: Record<string, string>;
}

/** Normalize an RTK Query error into a human message + request_id (§7.2). */
export function parseError(error: unknown): ParsedError {
  const fieldErrors: Record<string, string> = {};
  const err = error as { status?: number | string; data?: ProblemDetail } | undefined;
  const data = err?.data;

  if (data?.errors) {
    for (const e of data.errors) fieldErrors[e.field] = e.message;
  }

  let message =
    data?.detail ||
    data?.title ||
    (data?.errors?.length ? "Please fix the highlighted fields." : "") ||
    "Something went wrong. Please try again.";

  if (err?.status === 403 || data?.code === "FORBIDDEN") {
    if (message.includes("requires role") || message.includes("Platform administrator")) {
      message =
        "You don't have permission to do that. Contact your school administrator if you need access.";
    }
  }

  if (data?.code === "MODULE_NOT_SUBSCRIBED") {
    message = "This module isn't part of your school's subscription.";
  }

  if (err?.status === 401 || data?.code === "AUTHENTICATION_FAILED") {
    message = "Your session has expired. Please sign in again.";
  }

  if (err?.status === "FETCH_ERROR") {
    message =
      process.env.NODE_ENV === "development"
        ? `Cannot reach the API at ${API_URL}. Start the API (docker compose up -d api) and confirm port 5330.`
        : "Cannot reach the server. Check your connection and try again.";
  }

  return {
    message,
    code: data?.code,
    requestId: data?.request_id,
    fieldErrors,
  };
}
