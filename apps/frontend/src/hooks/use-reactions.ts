import { eq, useLiveQuery, useWorkspace } from "@entwine/db-collection/react";
import type { Reaction } from "../types/rows";

/** An issue's reactions and its comments', which load the first time its page asks. */
export function useReactions(issueId: string): Reaction[] {
  const ws = useWorkspace();
  const { data = [] } = useLiveQuery({
    query: (q) => q.from({ r: ws.collections.Reaction }).where(({ r }) => eq(r.issueId, issueId)),
  });
  return data;
}
