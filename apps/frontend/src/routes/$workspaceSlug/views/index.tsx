import { useRows } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@entwine/ui/components/ui/empty";
import { SearchField } from "@entwine/ui/components/ui/search-field";
import { createFileRoute } from "@tanstack/react-router";
import { PlusIcon, ViewIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useShell } from "../../../hooks/use-shell";
import { useStore } from "../../../hooks/use-store";
import { ViewItem } from "./-components/view-item";

export const Route = createFileRoute("/$workspaceSlug/views/")({ component: ViewsPage });

function ViewsPage() {
  const store = useStore();
  const shell = useShell();
  const [search, setSearch] = useState("");
  const views = [...useRows("View")]
    .filter((v) => v.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Views" icon={<ViewIcon />}>
        <SearchField
          aria-label="Search views"
          placeholder="Search views…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button size="sm" className="h-7 text-body" onClick={() => shell.openCreate("view")}>
          <PlusIcon />
          New view
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {views.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ViewIcon />
              </EmptyMedia>
              <EmptyTitle>{search ? "No views match" : "No views yet"}</EmptyTitle>
              <EmptyDescription>
                A view keeps a set of filters and a display, for a project or for all issues, that the whole workspace
                can open.
              </EmptyDescription>
            </EmptyHeader>
            {!search && (
              <EmptyContent>
                <Button size="sm" onClick={() => shell.openCreate("view")}>
                  <PlusIcon />
                  New view
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <ul aria-label="Views">
            {views.map((view) => (
              <ViewItem key={view.id} view={view} store={store} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
