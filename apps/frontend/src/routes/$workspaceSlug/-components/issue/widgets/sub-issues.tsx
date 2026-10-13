import { Button } from "@entwine/ui/components/ui/button";
import { CircularProgress } from "@entwine/ui/components/ui/circular-progress";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { progressOf } from "../../../../../lib/issue-tree";
import type { Store } from "../../../../../store";
import type { Issue } from "../../../../../types/rows";
import { IssueLink } from "../../issue-views/issue-link";
import { AssigneePicker } from "../../pickers/assignee-picker";
import { PriorityPicker } from "../../pickers/priority-picker";
import { StatePicker } from "../../pickers/state-picker";
import { WidgetSection } from "./widget-section";

export function SubIssues({
  issue,
  store,
  adding,
  onAdding,
  archived,
}: {
  issue: Issue;
  store: Store;
  adding: boolean;
  onAdding(on: boolean): void;
  archived: boolean;
}) {
  const [title, setTitle] = useState("");
  const children = store.issues.childrenOf(issue.id);
  const { done, planned } = progressOf(children, store);
  const create = () => {
    if (title.trim()) store.issues.create({ projectId: issue.projectId, title: title.trim(), parentId: issue.id });
    setTitle("");
  };
  return (
    <WidgetSection
      title="Sub-issues"
      addLabel="New sub-issue"
      onAdd={archived ? undefined : () => onAdding(true)}
      extra={
        children.length > 0 && (
          <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <CircularProgress value={planned ? (done / planned) * 100 : 0} size={14} label="Sub-issue progress" />
            {done} of {planned} done
          </span>
        )
      }
    >
      {children.length > 0 && (
        <ul className="flex flex-col" aria-label="Sub-issues">
          {children.map((child) => (
            <li
              key={child.id}
              className="group/line flex h-9 items-center gap-2 rounded-md px-1 text-body hover:bg-accent/50"
            >
              <StatePicker
                store={store}
                projectId={child.projectId}
                value={child.stateId}
                onChange={(stateId) => store.issues.update(child.id, { stateId })}
                face="icon"
              />
              <span className="w-14 shrink-0 text-caption font-medium text-muted-foreground tabular-nums">
                {store.issues.key(child)}
              </span>
              <IssueLink issue={child} className="min-w-0 flex-1 truncate" />
              {child.archivedAt !== null && <span className="text-caption text-muted-foreground">Archived</span>}
              <PriorityPicker
                value={child.priority as never}
                onChange={(priority) => store.issues.update(child.id, { priority })}
                face="icon"
              />
              <AssigneePicker
                store={store}
                value={child.assigneeId}
                onChange={(assigneeId) => store.issues.update(child.id, { assigneeId })}
                face="icon"
              />
              <Button
                variant="ghost"
                size="icon-xs"
                className="hover-reveal group-hover/line:opacity-100 focus-visible:opacity-100"
                aria-label={`Remove ${store.issues.key(child)} from sub-issues`}
                onClick={() => store.issues.update(child.id, { parentId: null })}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <div className="mt-1 flex h-9 items-center gap-2 rounded-md border border-primary/40 px-2">
          <PlusIcon className="size-4 text-muted-foreground" />
          <input
            autoFocus
            aria-label="Sub-issue title"
            placeholder="Sub-issue title, then Enter"
            className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground max-md:text-base"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") create();
              if (event.key === "Escape") onAdding(false);
            }}
            onBlur={() => !title.trim() && onAdding(false)}
          />
        </div>
      )}
    </WidgetSection>
  );
}
