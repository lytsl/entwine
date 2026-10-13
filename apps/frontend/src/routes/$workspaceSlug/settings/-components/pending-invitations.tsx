import { ROLE_LABELS, type Role } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { CopyIcon, MailIcon } from "lucide-react";
import { copyText } from "../../../../lib/clipboard";

export function PendingInvitations({
  invitations,
  onCancel,
}: {
  invitations: readonly { id: string; email: string; role: string }[];
  onCancel(invitationId: string): void;
}) {
  return (
    <ul aria-label="Pending invitations" className="overflow-hidden rounded-xl border bg-card/40">
      {invitations.map((invitation) => (
        <li
          key={invitation.id}
          className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-body last:border-b-0 hover:bg-accent/30"
        >
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground">
            <MailIcon className="size-3.5" />
          </span>
          <span className="min-w-40 flex-1 truncate">{invitation.email}</span>
          <span className="text-muted-foreground">{ROLE_LABELS[invitation.role as Role] ?? invitation.role}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyText(`${location.origin}/invite/${invitation.id}`, "Invitation link copied")}
          >
            <CopyIcon />
            Copy link
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onCancel(invitation.id)}>
            Cancel
          </Button>
        </li>
      ))}
    </ul>
  );
}
