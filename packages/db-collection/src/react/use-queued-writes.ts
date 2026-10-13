import { useSyncExternalStore } from "react";
import { useWorkspace } from "./use-workspace";

export function useQueuedWrites(): number {
  const workspace = useWorkspace();
  return useSyncExternalStore(
    (listener) => workspace.subscribe(listener),
    () => workspace.queued(),
  );
}
