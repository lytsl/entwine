import { eq, useLiveQuery, useWorkspace } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { BellIcon, BellOffIcon } from "lucide-react";
import type { Store } from "../../../../store";

/** Who follows the issue, and the member's own subscription: an archived issue can be followed and left too. */
export function Subscribers({ issueId, store }: { issueId: string; store: Store }) {
  const ws = useWorkspace();
  // Asking for one issue's rows loads them the first time; see the sync client.
  const { data = [] } = useLiveQuery({
    query: (q) => q.from({ s: ws.collections.IssueSubscription }).where(({ s }) => eq(s.issueId, issueId)),
  });
  const subscribed = data.some((s) => s.memberId === ws.userId);
  // A member who left is told nothing, so is not listed; their subscription waits for their return.
  const members = data
    .flatMap((s) => store.members.get(s.memberId) ?? [])
    .filter((member) => !member.removed)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section className="flex flex-col gap-2" aria-label="Subscribers">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-caption font-medium text-muted-foreground">
          Subscribers{members.length > 0 && ` · ${members.length}`}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={subscribed}
          onClick={() =>
            subscribed ? store.subscriptions.unsubscribe(issueId) : store.subscriptions.subscribe(issueId)
          }
        >
          {subscribed ? <BellOffIcon /> : <BellIcon />}
          {subscribed ? "Unsubscribe" : "Subscribe"}
        </Button>
      </div>
      {members.length === 0 ? (
        <p className="text-caption text-muted-foreground">Nobody is notified of this issue's activity.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
          {members.map((member) => (
            <li key={member.id} className="flex min-w-0 items-center gap-1.5 text-body">
              <UserAvatar user={member} size={18} />
              <span className="truncate">{member.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
