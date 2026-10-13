import type { Workspace } from "@entwine/db-collection/react";
import type { IssueQuery } from "@entwine/shared";

/** Holds the edits of saved views; the pages that list them read their rows with a live query. */
export class Views {
  constructor(private readonly ws: Workspace) {}

  create = (input: { name: string; projectId: string | null; query: IssueQuery }): string => {
    const id = crypto.randomUUID();
    const now = Date.now();
    void this.ws.mutate(() =>
      this.ws.collections.View.insert({
        id,
        name: input.name.trim(),
        projectId: input.projectId,
        query: JSON.stringify(input.query),
        creatorId: this.ws.userId,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return id;
  };

  update = (id: string, patch: { name?: string; query?: IssueQuery }) =>
    this.ws.mutate(() =>
      this.ws.collections.View.update(id, (view) => {
        if (patch.name !== undefined) view.name = patch.name.trim();
        if (patch.query) view.query = JSON.stringify(patch.query);
        view.updatedAt = Date.now();
      }),
    );

  delete = (id: string) => this.ws.mutate(() => this.ws.collections.View.delete(id));
}
