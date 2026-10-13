import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@entwine/ui/components/ui/empty";
import { SearchField } from "@entwine/ui/components/ui/search-field";
import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArchiveIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "../../../../../components/page-header";
import { ProjectCrumb } from "../../../../../components/project-crumb";
import { OVERSCAN } from "../../../../../constants/issue-view";
import { useStore } from "../../../../../hooks/use-store";
import { matches } from "../../../../../lib/search";
import { IssueScope } from "../../../-components/workspace/issue-scope";
import { ArchivedIssueRow } from "../-components/archives/archived-issue-row";

/** The height `h-11` gives a row. */
const ROW_HEIGHT = 44;

export const Route = createFileRoute("/$workspaceSlug/projects/$projectId/archives/")({ component: ScopedPage });

function ArchivesPage() {
  const { projectId } = Route.useParams();
  const store = useStore();
  const [search, setSearch] = useState("");
  const project = store.projects.get(projectId);
  const all = store.issues.list(store.issues.scope({ projectId, archived: true }));
  const archived = useMemo(() => [...all].sort((a, b) => b.archivedAt! - a.archivedAt!), [all]);
  const { projects } = store;
  const shown = useMemo(
    () =>
      search.trim()
        ? archived.filter((issue) =>
            matches(search, [`${projects.get(issue.projectId)?.identifier}-${issue.number}`, issue.title]),
          )
        : archived,
    [archived, search, projects],
  );
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: shown.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });
  if (!project) return <PageHeader title="Project not found" />;
  return (
    <>
      <PageHeader
        title="Archives"
        icon={<ArchiveIcon />}
        crumbs={[<ProjectCrumb key="project" project={project} to="archives" />]}
        count={archived.length}
      >
        <SearchField
          aria-label="Search archived issues"
          placeholder="Search archived issues…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </PageHeader>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ArchiveIcon />
              </EmptyMedia>
              <EmptyTitle>{archived.length ? "No archived issue matches" : "No archived issues"}</EmptyTitle>
              <EmptyDescription>
                Archive a completed or cancelled issue from its menu to put it away. It still counts in progress.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul aria-label="Archived issues" className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const issue = shown[item.index];
              return issue ? <ArchivedIssueRow key={issue.id} issue={issue} store={store} top={item.start} /> : null;
            })}
          </ul>
        )}
      </div>
    </>
  );
}

function ScopedPage() {
  return (
    <IssueScope scope={{ projectId: Route.useParams().projectId }}>
      <ArchivesPage />
    </IssueScope>
  );
}
