/**
 * The plan's limit is not a filter, so filtering and clearing filters stay inside it; progress counts every issue in
 * it whatever the view shows.
 */

import { type IssueQuery } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { Link, useNavigate } from "@tanstack/react-router";
import { ListPlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { CycleIcon } from "../../../../../../components/cycle-icon";
import { ModuleStatusIcon } from "../../../../../../components/module-status-icon";
import { PageHeader } from "../../../../../../components/page-header";
import { ProjectCrumb } from "../../../../../../components/project-crumb";
import { PLAN_NOUNS } from "../../../../../../constants/plan";
import { useStore } from "../../../../../../hooks/use-store";
import { useToday } from "../../../../../../hooks/use-today";
import { useViewUrl } from "../../../../../../hooks/use-view-url";
import { activeFilterCount } from "../../../../../../lib/issue-filters";
import { cyclePhase } from "../../../../../../lib/plan";
import { type Scope } from "../../../../../../store";
import { type Cycle, type Module, type PlanKind, type Project } from "../../../../../../types/rows";
import type { IssueScope } from "../../../../../../types/shell";
import { IssuesView } from "../../../../-components/issue-views/issues-view";
import { AddExistingDialog } from "../../../../-components/planning/add-existing-dialog";
import { ProjectArchivedBanner } from "../../../../-components/project/project-archived-banner";
import { SaveViewButton } from "../../../../-components/views/save-view-button";
import { PlanMenu } from "./plan-menu";
import { PlanOverview } from "./plan-overview";
import { PlansCrumb } from "./plans-crumb";

function MissingPlan({ kind, project }: { kind: PlanKind; project: Project }) {
  return (
    <>
      <PageHeader
        title={`${kind === "cycle" ? "Cycle" : "Module"} not found`}
        crumbs={[
          <ProjectCrumb key="project" project={project} />,
          <PlansCrumb key="plans" kind={kind} projectId={project.id} />,
        ]}
      />
      <p className="p-8 text-body text-muted-foreground">
        This {kind} no longer exists. Its issues are still in the project.{" "}
        <Link
          from="/$workspaceSlug"
          to={
            kind === "cycle"
              ? "/$workspaceSlug/projects/$projectId/cycles"
              : "/$workspaceSlug/projects/$projectId/modules"
          }
          params={{ projectId: project.id }}
          className="underline underline-offset-4"
        >
          Back to {PLAN_NOUNS[kind].many.toLowerCase()}
        </Link>
      </p>
    </>
  );
}

export function PlanIssuesPage({
  kind,
  projectId,
  planId,
  search,
}: {
  kind: PlanKind;
  projectId: string;
  planId: string;
  search: IssueQuery & { peek?: string };
}) {
  const { peek, ...query } = search;
  const url = useViewUrl();
  const store = useStore();
  const navigate = useNavigate({ from: "/$workspaceSlug" });
  const today = useToday();
  const [adding, setAdding] = useState(false);
  // The issues' store is the workspace's own, so the scope is the same object from edit to edit, as the shell
  // needs of the one it holds.
  const { issues } = store;
  const scope = useMemo<IssueScope & Scope>(
    () =>
      kind === "cycle"
        ? { ...issues.scope({ projectId, cycleId: planId }), seed: { projectId, cycleId: planId } }
        : {
            ...issues.scope({ projectId, moduleId: planId }),
            seed: { projectId, moduleIds: [planId] },
          },
    [kind, planId, projectId, issues],
  );
  const project = store.projects.get(projectId);
  if (!project) return <PageHeader title="Project not found" />;
  const plan = kind === "cycle" ? store.cycles.get(planId) : store.modules.get(planId);
  if (plan?.projectId !== projectId) return <MissingPlan kind={kind} project={project} />;
  const issueCount = store.issues.progress(planId).total - store.issues.archivedIn(planId);
  const frozen = project.archivedAt !== null;
  const icon =
    kind === "cycle" ? (
      <CycleIcon phase={cyclePhase(plan as Cycle, today)} />
    ) : (
      <ModuleStatusIcon status={(plan as Module).status} />
    );
  return (
    <>
      <IssuesView
        title={plan.name}
        icon={icon}
        crumbs={[
          <ProjectCrumb key="project" project={project} />,
          <PlansCrumb key="plans" kind={kind} projectId={projectId} />,
        ]}
        banner={
          <>
            <ProjectArchivedBanner project={project} />
            <PlanOverview kind={kind} plan={plan} store={store} query={query} onChange={url.onChange} />
          </>
        }
        inScope={scope}
        query={query}
        projectId={projectId}
        scope={scope}
        peek={peek}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-body"
              disabled={frozen}
              onClick={() => setAdding(true)}
            >
              <ListPlusIcon />
              Add existing
            </Button>
            <PlanMenu
              kind={kind}
              plan={plan}
              store={store}
              issueCount={issueCount}
              onDeleted={() =>
                navigate({
                  to:
                    kind === "cycle"
                      ? "/$workspaceSlug/projects/$projectId/cycles"
                      : "/$workspaceSlug/projects/$projectId/modules",
                  params: { projectId },
                })
              }
            />
          </>
        }
        // A saved view cannot hold the page's limit, so it keeps it as a filter.
        viewActions={
          activeFilterCount(query) > 0 && (
            <SaveViewButton
              query={{ ...query, ...(kind === "cycle" ? { cycles: [planId] } : { modules: [planId] }) }}
              projectId={projectId}
            />
          )
        }
        {...url}
      />
      {adding && <AddExistingDialog kind={kind} plan={plan} store={store} onClose={() => setAdding(false)} />}
    </>
  );
}
