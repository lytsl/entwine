import { useWorkspace } from "@entwine/db-collection/react";
import { REACTIONS } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@entwine/ui/components/ui/tooltip";
import { cn } from "@entwine/ui/lib/utils";
import { SmilePlusIcon } from "lucide-react";
import { listNames } from "../../../../../lib/member";
import type { Store } from "../../../../../store";
import type { Reaction } from "../../../../../types/rows";

/** The reactions to one target: an issue when `commentId` is null, or one of its comments. */
export function Reactions({
  issueId,
  commentId,
  reactions,
  store,
  readOnly,
  className,
}: {
  issueId: string;
  commentId: string | null;
  /** The issue's reactions, of every target. */
  reactions: readonly Reaction[];
  store: Store;
  /** An archived issue's reactions are shown, not added to or taken back. */
  readOnly: boolean;
  className?: string;
}) {
  const ws = useWorkspace();
  const own = reactions.filter((r) => r.commentId === commentId);
  const used = REACTIONS.flatMap((emoji) => {
    const rows = own.filter((r) => r.emoji === emoji).sort((a, b) => a.createdAt - b.createdAt);
    return rows.length ? [{ emoji, rows }] : [];
  });
  if (readOnly && !used.length) return null;
  return (
    <div role="group" aria-label="Reactions" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {used.map(({ emoji, rows }) => {
        const mine = rows.some((r) => r.userId === ws.userId);
        const names = listNames(rows.map((r) => store.members.get(r.userId)?.name ?? "Someone"));
        return (
          <Tooltip key={emoji}>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="xs"
                  disabled={readOnly}
                  aria-pressed={mine}
                  aria-label={`${emoji} ${rows.length}: ${names}`}
                  className={cn("tabular-nums", mine && "border-primary/60 bg-primary/10 hover:bg-primary/15")}
                  onClick={() => store.reactions.toggle(issueId, commentId, emoji)}
                />
              }
            >
              <span aria-hidden>{emoji}</span>
              {rows.length}
            </TooltipTrigger>
            <TooltipContent>{names}</TooltipContent>
          </Tooltip>
        );
      })}
      {!readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" className="text-muted-foreground" aria-label="Add reaction" />
            }
          >
            <SmilePlusIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="flex w-auto min-w-0 flex-row gap-0.5">
            {REACTIONS.map((emoji) => (
              <DropdownMenuItem
                key={emoji}
                aria-label={emoji}
                className="size-8 justify-center p-0 text-base"
                onClick={() => store.reactions.toggle(issueId, commentId, emoji)}
              >
                {emoji}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
