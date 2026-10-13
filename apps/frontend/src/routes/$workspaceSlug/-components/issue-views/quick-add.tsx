/** Enter creates an issue with the group's values and keeps the input open; Escape or leaving it empty closes it. */
import { cn } from "@entwine/ui/lib/utils";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useShell } from "../../../../hooks/use-shell";
import { canQuickAdd } from "../../../../lib/issue-groups";
import type { Store } from "../../../../store";
import type { NewIssueDefaults } from "../../../../types/shell";

type Seed = NewIssueDefaults & { projectId: string };

export function QuickAdd({
  seed,
  store,
  layout,
  groupName,
}: {
  seed: Seed;
  store: Store;
  layout: "list" | "board";
  groupName: string;
}) {
  const shell = useShell();
  const [title, setTitle] = useState<string | null>(null);
  const project = store.projects.get(seed.projectId);
  if (!project || !canQuickAdd(seed, store)) return null;

  if (title === null)
    return (
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 text-body text-muted-foreground transition-colors hover:text-foreground",
          layout === "list" ? "h-10 w-full px-4 hover:bg-accent/40" : "h-8 w-full rounded-md px-2 hover:bg-accent",
        )}
        onClick={() => setTitle("")}
      >
        <PlusIcon className="size-4" />
        New issue
      </button>
    );

  const create = () => {
    const text = title.trim();
    if (!text) return setTitle(null);
    // On a cycle or module page, the issue joins it as well as the group.
    store.issues.create({ ...shell.scope.current?.seed, ...seed, title: text });
    setTitle("");
  };
  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-background",
        layout === "list"
          ? "h-10 border-y border-primary/40 px-4"
          : "flex-col items-stretch rounded-lg border border-primary/40 p-2 shadow-xs",
      )}
    >
      <span className="text-caption text-muted-foreground">{project.identifier}</span>
      <input
        autoFocus
        aria-label={`Issue title in ${groupName}`}
        placeholder="Issue title"
        className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground/70 max-md:text-base"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            create();
          }
          if (event.key === "Escape") setTitle(null);
        }}
        onBlur={() => !title.trim() && setTitle(null)}
      />
      <span className="text-micro text-muted-foreground">Enter to add · Esc to close</span>
    </div>
  );
}
