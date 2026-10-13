import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { sessionQuery, workspacesQuery } from "./queries";

/** The session, or a redirect to sign in that comes back to `href`. */
export async function requireSession(queryClient: QueryClient, href: string) {
  const session = await queryClient.query(sessionQuery);
  if (!session) throw redirect({ to: "/login", search: { next: href } });
  return session;
}

/**
 * The workspaces as the server last listed them, asked again only after one was created or joined: a page does not
 * wait for them, and the workspace menu refreshes the list.
 */
export const knownWorkspaces = (queryClient: QueryClient) =>
  queryClient.query({ ...workspacesQuery, staleTime: Infinity });
