import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import type { Member } from "../../../../types/rows";

/** Overlapping avatars, the first few; whoever holds them names the people. */
export function MemberStack({
  members,
  size = 18,
  max = 3,
}: {
  members: readonly Member[];
  size?: number;
  max?: number;
}) {
  const more = members.length - max;
  return (
    <span className="flex items-center" aria-hidden>
      <span className="flex -space-x-1 *:ring-2 *:ring-card">
        {members.slice(0, max).map((member) => (
          <UserAvatar key={member.id} user={member} size={size} />
        ))}
      </span>
      {more > 0 && <span className="ml-1 text-caption text-muted-foreground tabular-nums">+{more}</span>}
    </span>
  );
}
