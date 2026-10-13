import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { getRouteApi } from "@tanstack/react-router";
import { LinkIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { copyText } from "../../../../../../lib/clipboard";
import { planUrl } from "../../../../../../lib/plan";
import type { Store } from "../../../../../../store";
import { type Cycle, type Module, type PlanKind } from "../../../../../../types/rows";
import { DeletePlanDialog } from "../../../../-components/planning/delete-plan-dialog";
import { PlanDialog } from "../../../../-components/planning/plan-dialog";

const workspaceRoute = getRouteApi("/$workspaceSlug");

export function PlanMenu({
  kind,
  plan,
  store,
  issueCount,
  onDeleted,
  className,
}: {
  kind: PlanKind;
  plan: Cycle | Module;
  store: Store;
  issueCount: number;
  onDeleted?(): void;
  className?: string;
}) {
  const { workspaceSlug } = workspaceRoute.useParams();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const frozen = store.projects.get(plan.projectId)?.archivedAt != null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${plan.name} actions`}
              className={className}
              onClick={(event) => event.stopPropagation()}
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem disabled={frozen} onClick={() => setDialog("edit")}>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyText(planUrl(workspaceSlug, kind, plan))}>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={!store.members.canManage(plan)}
            onClick={() => setDialog("delete")}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === "edit" && (
        <PlanDialog kind={kind} projectId={plan.projectId} plan={plan} onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && (
        <DeletePlanDialog
          kind={kind}
          plan={plan}
          issueCount={issueCount}
          onClose={() => setDialog(null)}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
