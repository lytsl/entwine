import { useWorkspace } from "@entwine/db-collection/react";
import { useMemo, useSyncExternalStore } from "react";
import { RootStore, type Store } from "../store";

/** Called once, by the shell; pages read the store with `useStore`. */
export function useRootStore(): Store {
  const ws = useWorkspace();
  const root = useMemo(() => new RootStore(ws), [ws]);
  return useSyncExternalStore(root.listen, () => root.current);
}
