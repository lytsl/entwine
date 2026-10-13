import type { IssueScope as Scope } from "@entwine/shared";
import type { ReactNode } from "react";
import { useIssueScope } from "../../../../hooks/use-issue-scope";

export function IssueScope({ scope, children }: { scope: Scope; children: ReactNode }) {
  const { ready, error } = useIssueScope(scope);
  if (error)
    return (
      <p role="alert" className="p-8 text-muted-foreground">
        {error.message}
      </p>
    );
  if (!ready)
    return (
      <p role="status" className="p-8 text-muted-foreground">
        Loading issues…
      </p>
    );
  return children;
}
