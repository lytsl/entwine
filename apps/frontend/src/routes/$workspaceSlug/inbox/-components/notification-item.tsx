import { NOTIFICATION_TEXT } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { cn } from "@entwine/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { MailIcon, MailOpenIcon } from "lucide-react";
import type { Store } from "../../../../store";
import type { Notification } from "../../../../types/rows";
import { When } from "../../-components/issue/activity/when";

/**
 * The whole row opens the issue, which reads every notification of that issue; the button beside it marks this one.
 */
export function NotificationItem({ notification, store }: { notification: Notification; store: Store }) {
  const actor = store.members.get(notification.actorId);
  const issue = store.issues.get(notification.issueId);
  const unread = notification.readAt === null;
  const toggle = unread ? "Mark as read" : "Mark as unread";
  return (
    <li
      className="group/notification relative flex min-h-14 items-center gap-3 border-b px-3 py-2 transition-colors hover:bg-accent/40 @min-[32rem]/main:px-5"
      data-unread={unread}
    >
      <span className="flex size-2 shrink-0">
        {unread && <span className="size-2 rounded-full bg-primary" role="img" aria-label="Unread" />}
      </span>
      <UserAvatar user={actor} size={24} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          from="/$workspaceSlug"
          to="/$workspaceSlug/issues/$issueId"
          params={{ issueId: notification.issueId }}
          className={cn("truncate text-body after:absolute after:inset-0", unread && "font-medium")}
          onClick={() => void store.notifications.readIssue(notification.issueId)}
        >
          {issue ? (
            <>
              <span className="text-muted-foreground">{store.issues.key(issue)}</span> {issue.title}
            </>
          ) : (
            "An issue"
          )}
        </Link>
        <span className="truncate text-caption text-muted-foreground">
          <span className="text-foreground">{actor?.name ?? "Someone"}</span> {NOTIFICATION_TEXT[notification.kind]} ·{" "}
          <When at={notification.createdAt} />
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="relative z-[1] hover-reveal group-hover/notification:opacity-100 focus-visible:opacity-100"
        aria-label={toggle}
        title={toggle}
        onClick={() => void store.notifications.setRead(notification.id, unread)}
      >
        {unread ? <MailOpenIcon /> : <MailIcon />}
      </Button>
    </li>
  );
}
