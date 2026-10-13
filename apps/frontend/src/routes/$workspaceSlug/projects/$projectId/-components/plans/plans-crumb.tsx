import { Link } from "@tanstack/react-router";
import { PLAN_NOUNS } from "../../../../../../constants/plan";
import type { PlanKind } from "../../../../../../types/rows";

export function PlansCrumb({ kind, projectId }: { kind: PlanKind; projectId: string }) {
  return (
    <Link
      from="/$workspaceSlug"
      to={
        kind === "cycle" ? "/$workspaceSlug/projects/$projectId/cycles" : "/$workspaceSlug/projects/$projectId/modules"
      }
      params={{ projectId }}
      className="rounded-md px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {PLAN_NOUNS[kind].many}
    </Link>
  );
}
