import { useSyncExternalStore } from "react";
import type { SyncStatus } from "../types/workspace";
import { useWorkspace } from "./use-workspace";

export function useSyncStatus(): SyncStatus {
  const workspace = useWorkspace();
  return useSyncExternalStore(
    (listener) => workspace.subscribe(listener),
    () => workspace.status,
  );
}
