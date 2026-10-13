import { createContext } from "react";

/** Set by an issue view: opens an issue in the panel beside it, not on its page. */
export const PeekContext = createContext<((issueId: string) => void) | null>(null);
