import { type IssueScope, issueQueries } from "@entwine/shared";
import { createLiveQueryCollection, eq } from "@tanstack/db";
import type { Client } from "./client";

/** How many times the client loaded the workspace: its bootstrap, and every rebuild after. */
export const bootstraps = (client: Client): number =>
  client.loads.filter((queries) => queries.some((q) => q.model === "Member" && !q.where)).length;

export const loadIssues = (client: Client, scope: IssueScope) => client.workspace.load(issueQueries(scope));

/**
 * Loads an issue's comments and activity into the client, or every issue's, as opening the issue does: a live query
 * by issue asks the collections for them. Resolves once they are there.
 */
export async function loadHistory(client: Client, issueId?: string): Promise<void> {
  const queries = [client.collections.Comment, client.collections.Activity].map((collection) =>
    createLiveQueryCollection((q) => {
      const from = q.from({ row: collection as never });
      return issueId === undefined ? from : from.where(({ row }) => eq((row as { issueId: string }).issueId, issueId));
    }),
  );
  await Promise.all(queries.map((query) => query.toArrayWhenReady()));
  await Promise.all(queries.map((query) => query.cleanup()));
}
