import type { IssueQuery, Layout } from "@entwine/shared";
import { useEffect } from "react";
import type { QueryChange } from "../types/issue-view";
import type { IssueScope } from "../types/shell";
import { useShell } from "./use-shell";

/** Tells the shell about the issue view on screen: what the palette and new issues act on. */
export function useViewOnScreen({
  query,
  onChange,
  onPeek,
  scope,
}: {
  query: IssueQuery;
  onChange: QueryChange;
  onPeek(issueId: string | null): void;
  scope?: IssueScope;
}) {
  const shell = useShell();

  // The palette switches this view's layout.
  useEffect(() => {
    const controls = { layout: query.layout, setLayout: (layout: Layout) => onChange({ layout }) };
    shell.view.current = controls;
    return () => {
      if (shell.view.current === controls) shell.view.current = null;
    };
  }, [shell, query.layout, onChange]);

  // "Open" on a newly created issue peeks at it here.
  useEffect(() => {
    shell.peek.current = onPeek;
    return () => {
      if (shell.peek.current === onPeek) shell.peek.current = null;
    };
  }, [shell, onPeek]);

  // A new issue made while a scoped view is on screen joins its cycle or module.
  useEffect(() => {
    shell.scope.current = scope ?? null;
    return () => {
      if (shell.scope.current === scope) shell.scope.current = null;
    };
  }, [shell, scope]);
}
