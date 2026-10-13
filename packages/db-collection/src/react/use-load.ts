import type { Query } from "@entwine/sync-engine/protocol";
import { useEffect, useState } from "react";
import { queryKey } from "../utils/queries";
import { useWorkspace } from "./use-workspace";

export function useLoad(queries: readonly Query[]): { ready: boolean; error?: Error } {
  const workspace = useWorkspace();
  const key = JSON.stringify(queries.map(queryKey));
  const [state, setState] = useState<{ key: string; ready: boolean; error?: Error }>(() => ({
    key,
    ready: queries.every((query) => workspace.isLoaded(query)),
  }));
  // biome-ignore lint/correctness/useExhaustiveDependencies: the queries are identified by their key.
  useEffect(() => {
    let active = true;
    if (!queries.every((query) => workspace.isLoaded(query))) setState({ key, ready: false });
    workspace.load(queries).then(
      () => active && setState({ key, ready: true }),
      (error) => active && setState({ key, ready: false, error }),
    );
    return () => {
      active = false;
    };
  }, [workspace, key]);
  return state.key === key ? state : { ready: queries.every((query) => workspace.isLoaded(query)) };
}
