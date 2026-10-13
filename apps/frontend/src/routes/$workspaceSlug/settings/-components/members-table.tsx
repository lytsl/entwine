import { ROLE_LABELS, type Role } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { XIcon } from "lucide-react";
import { RolePicker } from "./role-picker";

/** A member as Better Auth lists them. */
interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  user: { name: string; email: string; image?: string | null };
}

export function MembersTable({
  members,
  userId,
  roles,
  manages,
  onRole,
  onRemove,
}: {
  members: readonly WorkspaceMember[];
  userId: string;
  /** The roles that member may give. */
  roles: Role[];
  /** Whether that member may change or remove this one. */
  manages(member: WorkspaceMember): boolean;
  onRole(member: WorkspaceMember, role: Role): void;
  onRemove(member: WorkspaceMember): void;
}) {
  return (
    // A narrow page has no room for the email's column: the address goes under the name.
    <div role="table" aria-label="Members" className="overflow-hidden rounded-xl border bg-card/40">
      <div
        role="row"
        className="grid grid-cols-[minmax(0,1fr)_5.5rem_1.5rem] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-caption font-medium text-muted-foreground @min-[40rem]/main:grid-cols-[1fr_1fr_8rem_2rem]"
      >
        <span role="columnheader">Name</span>
        <span role="columnheader" className="hidden @min-[40rem]/main:block">
          Email
        </span>
        <span role="columnheader">Role</span>
        <span />
      </div>
      {members.map((member) => (
        <div
          key={member.id}
          role="row"
          className="grid grid-cols-[minmax(0,1fr)_5.5rem_1.5rem] items-center gap-x-3 border-b px-4 py-2 text-body last:border-b-0 hover:bg-accent/30 @min-[40rem]/main:h-12 @min-[40rem]/main:grid-cols-[1fr_1fr_8rem_2rem] @min-[40rem]/main:py-0"
        >
          <span role="cell" className="flex min-w-0 items-center gap-2.5">
            <UserAvatar user={{ id: member.userId, name: member.user.name, image: member.user.image }} size={26} />
            <span className="truncate font-medium">{member.user.name}</span>
            {member.userId === userId && <span className="text-caption text-muted-foreground">(you)</span>}
          </span>
          <span
            role="cell"
            className="col-start-1 row-start-2 truncate pl-9 text-caption text-muted-foreground @min-[40rem]/main:col-start-2 @min-[40rem]/main:row-start-1 @min-[40rem]/main:pl-0 @min-[40rem]/main:text-body"
          >
            {member.user.email}
          </span>
          <span role="cell" className="row-span-2 @min-[40rem]/main:row-span-1">
            {manages(member) ? (
              <RolePicker
                roles={roles}
                value={member.role as Role}
                label={`Role of ${member.user.name}: ${member.role}`}
                onChange={(role) => onRole(member, role)}
              />
            ) : (
              <span className="text-muted-foreground">{ROLE_LABELS[member.role as Role]}</span>
            )}
          </span>
          <span role="cell" className="row-span-2 @min-[40rem]/main:row-span-1">
            {manages(member) && member.userId !== userId ? (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${member.user.name}`}
                title="Remove from workspace"
                onClick={() => onRemove(member)}
              >
                <XIcon />
              </Button>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
