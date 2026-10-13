import { useLiveQuery as useDbLiveQuery } from "@tanstack/react-db";
import { useEffect } from "react";
import { useWorkspace } from "./use-workspace";

/**
 * TanStack DB's `useLiveQuery`, owned by the workspace, which retires the query before the collections it reads: a
 * query outlives its component by its idle GC, and takes the cleanup of a collection it depends on as a fault.
 */
// The cast keeps the hook's overloads, which a wrapper's own signature cannot restate.
export const useLiveQuery = ((...args: Parameters<typeof useDbLiveQuery>) => {
  const result = useDbLiveQuery(...args);
  const workspace = useWorkspace();
  // Normal idle GC still frees the query on unmount.
  useEffect(() => {
    if (result.collection) workspace.trackQuery(result.collection);
  }, [workspace, result.collection]);
  return result;
}) as typeof useDbLiveQuery;
