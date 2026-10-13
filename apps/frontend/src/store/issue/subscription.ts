import type { Workspace } from "@entwine/db-collection/react";
import { pairId } from "@entwine/shared";

/**
 * The member's own following of an issue. Its page reads who follows it with a live query, which loads the rows when
 * it asks; the server subscribes members for what happens to an issue.
 */
export class Subscriptions {
  constructor(private readonly ws: Workspace) {}

  subscribe = (issueId: string) =>
    this.ws.mutate(() =>
      this.ws.collections.IssueSubscription.insert({
        id: pairId(issueId, this.ws.userId),
        issueId,
        memberId: this.ws.userId,
        createdAt: Date.now(),
      }),
    );

  unsubscribe = (issueId: string) =>
    this.ws.mutate(() => this.ws.collections.IssueSubscription.delete(pairId(issueId, this.ws.userId)));
}
