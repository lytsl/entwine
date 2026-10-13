import { eq, or, useLiveQuery, useWorkspace } from "@entwine/db-collection/react";
import { RELATION_SIDES, type RelationSide, relationSide } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { cn } from "@entwine/ui/lib/utils";
import { ArrowLeftRightIcon, LinkIcon, NetworkIcon, PaperclipIcon, PlusIcon, XIcon } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { SIDE_ICONS, SIDE_LABELS } from "../../../../../constants/relation";
import { useAttach } from "../../../../../hooks/use-attach";
import { ancestorsOf } from "../../../../../lib/issue-tree";
import type { Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { Attachments } from "./attachments";
import { IssueLine } from "./issue-line";
import { IssueSearchDialog } from "./issue-search-dialog";
import { Links } from "./links";
import { SubIssues } from "./sub-issues";
import { WidgetSection } from "./widget-section";

type Adding = "sub-issue" | "link" | null;
type Searching = { kind: "sub-issue" } | { kind: "relation"; side: RelationSide } | null;

export function IssueWidgets({
  issue,
  store,
  archived,
  readOnly,
}: {
  issue: Issue;
  store: Store;
  archived: boolean;
  /** The issue is archived: its widgets are shown, with nothing to add or remove. */
  readOnly: boolean;
}) {
  const ws = useWorkspace();
  const [adding, setAdding] = useState<Adding>(null);
  const [searching, setSearching] = useState<Searching>(null);
  const { data: relations = [] } = useLiveQuery({
    query: (q) =>
      q
        .from({ r: ws.collections.IssueRelation })
        .where(({ r }) => or(eq(r.issueId, issue.id), eq(r.relatedId, issue.id))),
  });
  const { data: links = [] } = useLiveQuery({
    query: (q) => q.from({ l: ws.collections.IssueLink }).where(({ l }) => eq(l.issueId, issue.id)),
  });
  const { data: attachments = [] } = useLiveQuery({
    query: (q) => q.from({ a: ws.collections.Attachment }).where(({ a }) => eq(a.issueId, issue.id)),
  });
  const attach = useAttach(issue.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const chooseFiles = () => fileInput.current?.click();
  const attachAll = (files: FileList | null) => {
    for (const file of files ?? []) void attach(file);
  };
  // Files dragged from the desktop are attached where the attachments are listed; anything else dragged is not ours.
  const [dropping, setDropping] = useState(false);
  const carriesFiles = (event: DragEvent) => !readOnly && event.dataTransfer.types.includes("Files");
  // The other issue may be gone already, before the server's deletion of the relation arrives.
  const sides = relations
    .map((relation) => ({ relation, ...relationSide(relation, issue.id) }))
    .flatMap((r) => {
      const other = store.issues.get(r.otherId);
      return other && store.projects.has(other.projectId) ? [{ ...r, other }] : [];
    });
  const children = store.issues.childrenOf(issue.id);
  const ancestors = ancestorsOf(issue, store);
  const related = new Set(sides.map((s) => s.otherId));

  // Asked for while the dialog is open only: it is a pass over the scope's issues.
  const searchIssues = !searching
    ? []
    : searching.kind === "sub-issue"
      ? store.issues
          .list(store.issues.scope({ projectId: issue.projectId }))
          .filter((i) => i.id !== issue.id && i.parentId !== issue.id && !ancestors.has(i.id))
      : store.issues.list(store.issues.scope({})).filter((i) => i.id !== issue.id && !related.has(i.id));

  return (
    <fieldset
      disabled={readOnly}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-lg",
        dropping && "outline-2 outline-offset-8 outline-primary outline-dashed",
      )}
      onDragOver={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setDropping(false);
        attachAll(event.dataTransfer.files);
      }}
    >
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-7 text-body" />}>
              <NetworkIcon />
              Add sub-issue
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem disabled={archived} onClick={() => setAdding("sub-issue")}>
                <PlusIcon />
                New sub-issue
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearching({ kind: "sub-issue" })}>
                <NetworkIcon />
                Add existing issue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-7 text-body" />}>
              <ArrowLeftRightIcon />
              Add relation
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {RELATION_SIDES.map((side) => (
                <DropdownMenuItem key={side} onClick={() => setSearching({ kind: "relation", side })}>
                  {SIDE_ICONS[side]}
                  {SIDE_LABELS[side]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-7 text-body" onClick={() => setAdding("link")}>
            <LinkIcon />
            Add link
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-body" onClick={chooseFiles}>
            <PaperclipIcon />
            Attach file
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            tabIndex={-1}
            onChange={(event) => {
              attachAll(event.target.files);
              // The same file can be chosen again.
              event.target.value = "";
            }}
          />
        </div>
      )}

      {(children.length > 0 || adding === "sub-issue") && (
        <SubIssues
          issue={issue}
          store={store}
          adding={adding === "sub-issue"}
          onAdding={(on) => setAdding(on ? "sub-issue" : null)}
          archived={archived}
        />
      )}

      {sides.length > 0 && (
        <WidgetSection
          title="Relations"
          extra={<span className="text-caption text-muted-foreground">{sides.length}</span>}
        >
          <div className="flex flex-col gap-2">
            {RELATION_SIDES.map((side) => {
              const items = sides.filter((r) => r.side === side);
              return items.length ? (
                <div key={side}>
                  <h3 className="flex items-center gap-1.5 px-2 py-1 text-caption font-medium text-muted-foreground [&_svg]:size-3.5">
                    {SIDE_ICONS[side]}
                    {SIDE_LABELS[side]}
                  </h3>
                  <ul aria-label={SIDE_LABELS[side]}>
                    {items.map(({ relation, other }) => (
                      <IssueLine key={relation.id} issue={other} store={store}>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="hover-reveal group-hover/line:opacity-100 focus-visible:opacity-100"
                          aria-label={`Remove relation to ${store.issues.key(other)}`}
                          onClick={() => store.relations.delete(relation.id)}
                        >
                          <XIcon />
                        </Button>
                      </IssueLine>
                    ))}
                  </ul>
                </div>
              ) : null;
            })}
          </div>
        </WidgetSection>
      )}

      {(links.length > 0 || adding === "link") && (
        <Links
          issue={issue}
          store={store}
          links={links}
          adding={adding === "link"}
          onAdding={(on) => setAdding(on ? "link" : null)}
        />
      )}

      {attachments.length > 0 && <Attachments store={store} attachments={attachments} onAdd={chooseFiles} />}

      {searching && (
        <IssueSearchDialog
          title={searching.kind === "sub-issue" ? "Add sub-issue" : SIDE_LABELS[searching.side]}
          store={store}
          issues={searchIssues}
          onClose={() => setSearching(null)}
          onSelect={(other) => {
            if (searching.kind === "sub-issue") return void store.issues.update(other.id, { parentId: issue.id });
            const side = searching.side;
            if (side === "blocked_by") return void store.relations.create(other.id, issue.id, "blocks");
            void store.relations.create(issue.id, other.id, side === "blocks" ? "blocks" : side);
          }}
        />
      )}
    </fieldset>
  );
}
