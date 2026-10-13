import { type PropertyFace, PropertyPlaceholder, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { cn } from "@entwine/ui/lib/utils";
import { UserCircle2Icon } from "lucide-react";
import { assigneeOptions } from "../../../../lib/issue-options";
import type { Store } from "../../../../store";

export function AssigneePicker({
  store,
  value,
  onChange,
  face = "pill",
  showName = face === "field" || face === "cell",
}: {
  store: Store;
  value: string | null;
  onChange(assigneeId: string | null): void;
  face?: PropertyFace;
  showName?: boolean;
}) {
  const assignee = value ? store.members.get(value) : undefined;
  const name = assignee?.name ?? "Unassigned";
  return (
    <PropertySelect<string | null>
      label={`Assignee: ${name}`}
      tooltip={showName ? undefined : `Assignee: ${name}`}
      face={face}
      align="end"
      searchPlaceholder="Assign to…"
      options={() => assigneeOptions(store)}
      isSelected={(id) => id === value}
      onSelect={(id) => id !== value && onChange(id)}
      // An assigned pill is the avatar alone; the border only frames the empty state.
      className={cn(face === "pill" && assignee && !showName && "border-transparent px-0.5")}
    >
      {assignee ? (
        <UserAvatar user={assignee} size={face === "pill" ? 18 : 20} />
      ) : face === "pill" && !showName ? (
        <UserCircle2Icon />
      ) : (
        <UserAvatar user={null} size={face === "pill" ? 16 : 20} />
      )}
      {showName &&
        (assignee ? (
          <span className="truncate">{assignee.name}</span>
        ) : (
          <PropertyPlaceholder>Unassigned</PropertyPlaceholder>
        ))}
    </PropertySelect>
  );
}
