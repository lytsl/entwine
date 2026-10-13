/**
 * Shared by the issue's page and the peek. The page puts the properties in a sidebar; the peek, and a page too narrow
 * for a sidebar, stack them under the widgets.
 */
import { cn } from "@entwine/ui/lib/utils";
import { useFits } from "../../../../hooks/use-fits";
import type { Store } from "../../../../store";
import type { Issue } from "../../../../types/rows";
import { ProjectArchivedBanner } from "../project/project-archived-banner";
import { Activity } from "./activity/activity";
import { IssueArchivedBanner } from "./issue-archived-banner";
import { IssuePropertiesPanel } from "./issue-properties-panel";
import { ParentChip } from "./parent-chip";
import { IssueReactions } from "./reactions/issue-reactions";
import { Subscribers } from "./subscribers";
import { TitleAndDescription } from "./title-and-description";
import { IssueWidgets } from "./widgets/issue-widgets";

/** The page's sidebar and the least room the issue beside it needs, in pixels. */
const SIDEBAR_FITS = 768;

export function IssueDetail({ issue, store, layout }: { issue: Issue; store: Store; layout: "page" | "peek" }) {
  const project = store.projects.get(issue.projectId);
  const archived = project?.archivedAt != null;
  const readOnly = issue.archivedAt !== null;
  const banners = (
    <>
      <IssueArchivedBanner issue={issue} store={store} />
      <ProjectArchivedBanner project={project} />
    </>
  );
  const main = (
    <>
      <div className="flex flex-col gap-3">
        <ParentChip issue={issue} store={store} />
        <TitleAndDescription key={issue.id} issue={issue} readOnly={readOnly} />
        <IssueReactions issueId={issue.id} store={store} readOnly={readOnly} />
      </div>
      <IssueWidgets issue={issue} store={store} archived={archived} readOnly={readOnly} />
    </>
  );
  const [page, fits] = useFits(SIDEBAR_FITS);
  if (layout === "peek" || !fits)
    return (
      <>
        {banners}
        <div
          ref={layout === "page" ? page : undefined}
          className={cn(
            "flex flex-col gap-8 px-4 py-6 @min-[32rem]/main:px-8",
            layout === "page" && "min-h-0 flex-1 overflow-y-auto",
          )}
        >
          {main}
          <div className="flex flex-col gap-4 rounded-lg border bg-card/40 p-4">
            <IssuePropertiesPanel issue={issue} store={store} readOnly={readOnly} />
            <Subscribers issueId={issue.id} store={store} />
          </div>
          <Activity issueId={issue.id} store={store} readOnly={readOnly} />
        </div>
      </>
    );
  return (
    <>
      {banners}
      <div ref={page} className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-8 px-8 py-8">
            {main}
            <div className="border-t pt-6">
              <Activity issueId={issue.id} store={store} readOnly={readOnly} />
            </div>
          </div>
        </div>
        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l bg-sidebar/40 px-4 py-5">
          <IssuePropertiesPanel issue={issue} store={store} readOnly={readOnly} />
          <Subscribers issueId={issue.id} store={store} />
        </aside>
      </div>
    </>
  );
}
