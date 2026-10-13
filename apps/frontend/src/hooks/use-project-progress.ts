import { useWorkspace } from "@entwine/db-collection/react";
import { type Progress, progressOfCounts } from "@entwine/shared";
import { useThrottledCallback } from "@tanstack/react-pacer";
import { useEffect, useState } from "react";
import type { Store } from "../store";

/** The server counts again at most this often while issues change, in milliseconds. */
const RECOUNT = 2000;

/**
 * Every project's progress, counted by the server: the tab holds the issues of the projects it opened, not all of
 * them. Until the server answers, a project shows the issues the tab holds.
 */
export function useProjectProgress(store: Store): (projectId: string) => Progress {
  const ws = useWorkspace();
  const [counted, setCounted] = useState<Map<string, [stateId: string, count: number][]>>();
  const count = useThrottledCallback(
    () =>
      void ws.find([{ model: "Issue", count: ["projectId", "stateId"] }]).then(
        ({ counts }) => {
          if (!counts) return;
          const byProject = Map.groupBy(counts[0], (row) => row.values[0] as string);
          setCounted(
            new Map([...byProject].map(([id, rows]) => [id, rows.map((row) => [row.values[1] as string, row.count])])),
          );
        },
        () => {},
      ),
    { wait: RECOUNT },
  );
  useEffect(() => {
    count();
    return store.issues.listen(count);
  }, [count, store.issues]);
  return (projectId) =>
    counted
      ? progressOfCounts(
          (counted.get(projectId) ?? []).map(([stateId, n]) => [store.states.get(stateId)?.group, n] as const),
        )
      : store.issues.progress(projectId);
}
