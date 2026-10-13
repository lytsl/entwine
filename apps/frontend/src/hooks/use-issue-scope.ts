import { useLoad, useWorkspace } from "@entwine/db-collection/react";
import { issueQueries, type IssueScope as Scope } from "@entwine/shared";
import { useMemo } from "react";

/** An issue already held is scoped by its project, whose rows may be loaded already. */
export function useIssueScope(scope: Scope) {
  const { collections } = useWorkspace();
  const key = JSON.stringify(scope);
  // biome-ignore lint/correctness/useExhaustiveDependencies: resolved once per scope, not whenever the issue changes.
  const queries = useMemo(() => {
    const projectId =
      typeof scope === "object" && "issueId" in scope ? collections.Issue.get(scope.issueId)?.projectId : undefined;
    return issueQueries(projectId ? { projectId } : scope);
  }, [key, collections]);
  return useLoad(queries);
}
