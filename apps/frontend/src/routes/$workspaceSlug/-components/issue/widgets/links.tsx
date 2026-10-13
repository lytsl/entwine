import { Button } from "@entwine/ui/components/ui/button";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { GlobeIcon, PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { timeAgo } from "../../../../../lib/dates";
import type { Store } from "../../../../../store";
import type { Issue, IssueLink as IssueLinkRow } from "../../../../../types/rows";
import { LinkForm } from "./link-form";
import { WidgetSection } from "./widget-section";

const hostOf = (url: string) => (URL.canParse(url) ? new URL(url).host : url);

export function Links({
  issue,
  store,
  links,
  adding,
  onAdding,
}: {
  issue: Issue;
  store: Store;
  links: IssueLinkRow[];
  adding: boolean;
  onAdding(on: boolean): void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = [...links].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return (
    <WidgetSection
      title="Links"
      addLabel="Add link"
      onAdd={() => onAdding(true)}
      extra={<span className="text-caption text-muted-foreground">{links.length}</span>}
    >
      {sorted.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Links">
          {sorted.map((link) =>
            editing === link.id ? (
              <li key={link.id}>
                <LinkForm
                  link={link}
                  onCancel={() => setEditing(null)}
                  onSave={(value) => {
                    void store.links.update(link.id, value);
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li
                key={link.id}
                className="group/line flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2 hover:bg-accent/40"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <GlobeIcon className="size-3.5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-body font-medium hover:underline"
                  >
                    {link.title || link.url}
                  </a>
                  <span className="flex items-center gap-1 truncate text-caption text-muted-foreground">
                    {hostOf(link.url)} · added {timeAgo(link.createdAt)} by{" "}
                    <UserAvatar user={store.members.get(link.creatorId)} size={14} />
                    {store.members.get(link.creatorId)?.name ?? "someone"}
                  </span>
                </div>
                <span className="flex items-center hover-reveal group-hover/line:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Edit link ${link.title || link.url}`}
                    onClick={() => setEditing(link.id)}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove link ${link.title || link.url}`}
                    onClick={() => store.links.delete(link.id)}
                  >
                    <XIcon />
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      {adding && (
        <LinkForm
          onCancel={() => onAdding(false)}
          onSave={({ url, title }) => {
            void store.links.create(issue.id, url, title);
            onAdding(false);
          }}
        />
      )}
    </WidgetSection>
  );
}
