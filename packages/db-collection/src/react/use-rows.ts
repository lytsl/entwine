import type { RegisteredRows } from "./types";
import { useLiveQuery } from "./use-live-query";
import { useWorkspace } from "./use-workspace";

export function useRows<M extends keyof RegisteredRows & string>(model: M): RegisteredRows[M][] {
  const { collections } = useWorkspace();
  const { data } = useLiveQuery({ query: (q) => q.from({ row: collections[model] as never }) });
  return (data ?? []) as RegisteredRows[M][];
}
