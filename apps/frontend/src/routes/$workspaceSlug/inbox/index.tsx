import { useLoad } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@entwine/ui/components/ui/empty";
import { SegmentedControl, SegmentedControlItem } from "@entwine/ui/components/ui/segmented-control";
import { createFileRoute } from "@tanstack/react-router";
import { BellIcon, CheckCheckIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useStore } from "../../../hooks/use-store";
import { NotificationItem } from "./-components/notification-item";

export const Route = createFileRoute("/$workspaceSlug/inbox/")({ component: InboxPage });

/**
 * The issues the member's notifications are about, whatever project they are in. The selection is of the member's
 * own notifications, and a new one brings its issue.
 */
const ISSUES = [{ model: "Issue", where: { id: { model: "Notification", select: "issueId" } } }];

function InboxPage() {
  const store = useStore();
  const [show, setShow] = useState<"all" | "unread" | "mentions">("all");
  useLoad(ISSUES);
  const { sorted, unread } = store.notifications;
  const shown =
    show === "all" ? sorted : sorted.filter((n) => (show === "unread" ? n.readAt === null : n.kind === "mentioned"));
  return (
    <>
      <PageHeader title="Inbox" icon={<BellIcon />}>
        <SegmentedControl aria-label="Show" value={show} onValueChange={setShow}>
          <SegmentedControlItem value="all">All</SegmentedControlItem>
          <SegmentedControlItem value="unread">Unread{unread > 0 && ` (${unread})`}</SegmentedControlItem>
          <SegmentedControlItem value="mentions">Mentions</SegmentedControlItem>
        </SegmentedControl>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-body"
          disabled={unread === 0}
          onClick={() => void store.notifications.readAll()}
        >
          <CheckCheckIcon />
          Mark all as read
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon />
              </EmptyMedia>
              <EmptyTitle>
                {!sorted.length ? "No notifications yet" : show === "unread" ? "Nothing unread" : "No mentions"}
              </EmptyTitle>
              {!sorted.length && (
                <EmptyDescription>
                  You are told here when someone assigns an issue to you or mentions you, and when an issue you follow
                  gets a comment or changes state.
                </EmptyDescription>
              )}
            </EmptyHeader>
          </Empty>
        ) : (
          <ul aria-label="Notifications">
            {shown.map((notification) => (
              <NotificationItem key={notification.id} notification={notification} store={store} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
