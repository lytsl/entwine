import type { ErrorCode, ErrorResponse } from "@entwine/sync-engine/protocol";
import type { SyncStatus } from "./types/workspace";

/** `code` is the server's, or `offline` when it could not be reached. */
export class SyncError extends Error {
  constructor(
    readonly code: ErrorCode | "offline",
    message: string,
  ) {
    super(message);
  }
}
export const closedError = () => new SyncError("offline", "The workspace was closed; the change was not confirmed");

export async function failure(response: Response): Promise<SyncError> {
  const body = (await response.json().catch(() => null)) as ErrorResponse | null;
  return new SyncError(body?.code ?? "failed", body?.error ?? `The server answered ${response.status}`);
}

/** The status a refusal ends in, if it is final. */
export function finalStatus(error: unknown): SyncStatus | undefined {
  if (!(error instanceof SyncError)) return;
  if (error.code === "unauthenticated") return "unauthenticated";
  if (error.code === "forbidden") return "revoked";
}
