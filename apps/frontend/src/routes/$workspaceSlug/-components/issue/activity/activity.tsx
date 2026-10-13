import { eq, useLiveQuery, useWorkspace } from "@entwine/db-collection/react";
import { RichText } from "@entwine/ui/components/editor/rich-text";
import { Button } from "@entwine/ui/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@entwine/ui/components/ui/segmented-control";
import { Spinner } from "@entwine/ui/components/ui/spinner";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { useState } from "react";
import { useReactions } from "../../../../../hooks/use-reactions";
import { useTextFiles } from "../../../../../hooks/use-text-files";
import { activityIcon, actorName, describe } from "../../../../../lib/activity";
import { submitHint } from "../../../../../lib/shortcuts";
import type { Store } from "../../../../../store";
import type { CommentDraft } from "../../../../../types/comment";
import { CommentItem } from "./comment-item";
import { When } from "./when";

const BLANK: CommentDraft = { markdown: "", empty: true };

type Filter = "all" | "comments" | "updates";

/** Entries a timeline shows at first, the newest; and how many more each request for earlier ones adds. */
const RECENT = 100;
const EARLIER = 400;

export function Activity({
  issueId,
  store,
  readOnly = false,
}: {
  issueId: string;
  store: Store;
  /** An archived issue's comments are shown, not added to or changed. */
  readOnly?: boolean;
}) {
  const ws = useWorkspace();
  const [draft, setDraft] = useState<CommentDraft>(BLANK);
  // Starts the composer afresh after sending.
  const [round, setRound] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  // How many entries are shown, for the issue it was asked of: the peek shows one issue after another.
  const [limit, setLimit] = useState({ issueId, entries: RECENT });
  const shown = limit.issueId === issueId ? limit.entries : RECENT;
  // Asking for one issue's rows loads its history the first time; see the sync client.
  const commentQuery = useLiveQuery({
    query: (q) => q.from({ c: ws.collections.Comment }).where(({ c }) => eq(c.issueId, issueId)),
  });
  const activityQuery = useLiveQuery({
    query: (q) => q.from({ a: ws.collections.Activity }).where(({ a }) => eq(a.issueId, issueId)),
  });
  const reactions = useReactions(issueId);
  const files = useTextFiles(issueId);
  const loading = !commentQuery.isReady || !activityQuery.isReady;
  const comments = commentQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const entries = [
    ...(filter !== "updates" ? comments.map((comment) => ({ at: comment.createdAt, id: comment.id, comment })) : []),
    ...(filter !== "comments" ? activity.map((a) => ({ at: a.createdAt, id: a.id, activity: a })) : []),
  ].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const earlier = Math.max(0, entries.length - shown);
  const me = store.members.get(ws.userId);
  const submit = () => {
    if (draft.empty) return;
    void store.comments.create(issueId, draft.markdown);
    setDraft(BLANK);
    setRound((n) => n + 1);
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Activity">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Activity</h2>
        <SegmentedControl aria-label="Show" value={filter} onValueChange={setFilter}>
          {(["all", "comments", "updates"] as const).map((value) => (
            <SegmentedControlItem key={value} value={value} className="capitalize">
              {value}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
      {loading && (
        <p className="flex items-center gap-2 text-caption text-muted-foreground">
          <Spinner />
          Loading history…
        </p>
      )}
      {earlier > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setLimit({ issueId, entries: shown + EARLIER })}
        >
          Show earlier activity ({earlier.toLocaleString()} more)
        </Button>
      )}
      <ol className="flex flex-col">
        {entries.slice(earlier).map((entry) =>
          "comment" in entry ? (
            <CommentItem
              key={entry.id}
              comment={entry.comment}
              reactions={reactions}
              store={store}
              readOnly={readOnly}
            />
          ) : (
            <li key={entry.id} className="relative flex items-center gap-3 pb-4" data-testid="activity">
              <span className="absolute top-7 bottom-0 left-[13px] w-px bg-border" aria-hidden />
              <span className="z-[1] flex size-7 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground [&_svg]:size-3.5">
                {activityIcon(entry.activity, store)}
              </span>
              <p className="min-w-0 wrap-anywhere text-caption text-muted-foreground">
                <span className="font-medium text-foreground">{actorName(entry.activity, store)}</span>{" "}
                {describe(entry.activity, store)} · <When at={entry.at} />
              </p>
            </li>
          ),
        )}
      </ol>
      {!readOnly && (
        <div className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center">
            <UserAvatar user={me} size={26} />
          </span>
          <div className="min-w-0 flex-1 rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring/40">
            <RichText
              key={round}
              autoFocus={round > 0}
              aria-label="Comment"
              placeholder="Leave a comment…"
              files={files}
              value={draft.markdown}
              people={store.members.people}
              onChange={(markdown, { empty }) => setDraft({ markdown, empty })}
              onSubmit={submit}
              className="px-3 pt-2.5 pb-1 [&_.tiptap]:min-h-16"
            />
            <div className="flex items-center justify-end gap-2 px-2 pb-2">
              <span className="text-micro text-muted-foreground">{submitHint()} to send</span>
              <Button size="sm" disabled={draft.empty} onClick={submit}>
                Comment
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
