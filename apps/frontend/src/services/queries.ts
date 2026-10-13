import type { AppConfig } from "@entwine/shared";
import { queryOptions } from "@tanstack/react-query";
import { authClient, type WorkspaceInfo } from "./auth-client";

/**
 * Asked once per page load and kept for the tab's life: a page of an open tab must not wait for the server to say it
 * again, which offline it never does. Signing in or out clears it, and a session that ended elsewhere is refused by
 * the sync stream.
 */
export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: async () => (await authClient.getSession()) ?? null,
  staleTime: Infinity,
});

export const workspacesQuery = queryOptions({
  queryKey: ["workspaces"],
  queryFn: async (): Promise<WorkspaceInfo[]> => (await authClient.organization.list()) ?? [],
  staleTime: 60_000,
});

export const fullWorkspaceQuery = (workspaceId: string) =>
  queryOptions({
    queryKey: ["workspace", workspaceId],
    queryFn: () => authClient.organization.getFullOrganization({ query: { organizationId: workspaceId } }),
  });

/** What the server offers, which changes only when it restarts. */
export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: async (): Promise<AppConfig> => (await fetch("/api/config")).json(),
  staleTime: Infinity,
});
