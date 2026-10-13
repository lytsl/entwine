import type { SyncStatus } from "@entwine/db-collection";
import { useQueuedWrites, useSyncStatus, useWorkspace } from "@entwine/db-collection/react";
import { cn } from "@entwine/ui/lib/utils";

const STATUS_LABELS = {
  connecting: "Connecting",
  live: "Live",
  offline: "Offline",
  revoked: "No access",
  unauthenticated: "Signed out",
} satisfies Record<SyncStatus, string>;

/** All tabs with a shared device store can keep edits while offline. */
const OFFLINE_HINTS = {
  local: "You are offline. You can continue making changes. They will be synced when you are back online.",
  memory: "You are offline. Changes made in this tab wait in it until you are back online; closing the tab loses them.",
};

/** A live region, so going offline and coming back are said aloud. */
export function SyncIndicator({ className }: { className?: string }) {
  const status = useSyncStatus();
  const queued = useQueuedWrites();
  const { role } = useWorkspace();
  const label =
    status === "offline" && queued
      ? `Offline · ${queued} ${queued === 1 ? "change" : "changes"} waiting`
      : STATUS_LABELS[status];
  const hint = status === "offline" ? OFFLINE_HINTS[role === "memory" ? "memory" : "local"] : undefined;
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex h-7 items-center gap-2 px-2 text-caption text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
        className,
      )}
      title={hint ?? label}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", status === "live" ? "bg-success" : "animate-pulse bg-warning")}
      />
      <span className="group-data-[collapsible=icon]:hidden" data-testid="sync-status">
        {label}
      </span>
      {hint && <span className="sr-only">{hint}</span>}
    </div>
  );
}
