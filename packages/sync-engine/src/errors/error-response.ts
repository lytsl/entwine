import type { ErrorCode, ErrorResponse } from "../protocol";
import { WriteError } from "./write-error";

export const errorResponse = (status: number, code: ErrorCode, error: string): Response =>
  Response.json({ error, code } satisfies ErrorResponse, { status });

const STATUS: Record<WriteError["code"], number> = { invalid: 400, forbidden: 403, not_found: 404, conflict: 409 };

/** Anything but a refusal is the server's fault and is rethrown. */
export function refusal(error: unknown): Response {
  if (error instanceof WriteError) return errorResponse(STATUS[error.code], error.code, error.message);
  if (error instanceof Error && /constraint/i.test(error.message)) return errorResponse(409, "conflict", error.message);
  throw error;
}
