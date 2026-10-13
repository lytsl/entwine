import { attachmentPath } from "@entwine/shared";

/** `offline`: the server was not reached. `refused` carries what the server said. */
export type Upload =
  | { ok: true }
  | { ok: false; reason: "offline" }
  | { ok: false; reason: "refused"; message: string };

/**
 * Stores a file's bytes under `id`, before the `Attachment` row that names them. A plain request rather than a queued
 * write: megabytes do not belong in the outbox, so an upload needs the server there and then.
 */
export async function uploadFile(workspaceId: string, id: string, file: File): Promise<Upload> {
  let response: Response;
  try {
    response = await fetch(attachmentPath(workspaceId, id), {
      method: "POST",
      body: file,
      credentials: "same-origin",
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return { ok: false, reason: "offline" };
  }
  if (response.ok) return { ok: true };
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, reason: "refused", message: body?.error ?? "The file could not be uploaded" };
}
