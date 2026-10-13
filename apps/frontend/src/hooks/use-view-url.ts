import type { IssueQuery } from "@entwine/shared";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

/** Filter changes replace the history entry, while opening an issue adds one, so that Back closes the panel. */
export function useViewUrl() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      onChange: (patch: Partial<IssueQuery>) =>
        void navigate({ to: ".", search: (prev: object) => ({ ...prev, ...patch }), replace: true }),
      onPeek: (peek: string | null) =>
        void navigate({ to: ".", search: (prev: object) => ({ ...prev, peek: peek ?? undefined }) }),
    }),
    [navigate],
  );
}
