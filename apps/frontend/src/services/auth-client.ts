import { ACCOUNT_FIELDS } from "@entwine/shared";
import { inferAdditionalFields, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: { throw: true },
  plugins: [organizationClient(), inferAdditionalFields({ user: ACCOUNT_FIELDS })],
});

export type WorkspaceInfo = { id: string; name: string; slug: string };

/** Better Auth's fetch errors carry the server's body in `error`. */
export function errorMessage(error: unknown): string {
  const e = error as { error?: { message?: unknown }; message?: unknown } | null;
  const message = e?.error?.message ?? e?.message;
  return typeof message === "string" && message ? message : "Something went wrong. Please try again.";
}

/** The code Better Auth gives a refusal, such as `SESSION_EXPIRED`. */
export const errorCode = (error: unknown): string | undefined =>
  (error as { error?: { code?: string } } | null)?.error?.code;
