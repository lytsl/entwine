import { useEffect } from "react";
import type { ContextSource } from "../types/shell";
import { useShell } from "./use-shell";

/** Makes `issueId` the issue `source` shows while the caller is mounted. */
export function useIssueInContext(source: ContextSource, issueId: string | null | undefined) {
  const shell = useShell();
  useEffect(() => {
    if (!issueId) return;
    shell.shown.set(source, issueId);
    return () => {
      if (shell.shown.get(source) === issueId) shell.shown.delete(source);
    };
  }, [shell, source, issueId]);
}
