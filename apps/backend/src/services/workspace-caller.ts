import type { Auth } from "../auth/create-auth";

/** The caller's membership, from the auth database and never from the request; null without a session. */
export async function workspaceCaller(auth: Auth, workspaceId: string, headers: Headers) {
  const session = await auth.auth.api.getSession({ headers });
  if (!session) return null;
  const membership = auth.workspaceExists(workspaceId) ? auth.membership(workspaceId, session.user.id) : null;
  return { userId: session.user.id, membership };
}
