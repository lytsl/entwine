import { createContext } from "react";
import type { ContextSource, Shell } from "../types/shell";

export const ShellContext = createContext<Shell | null>(null);

const SOURCES: ContextSource[] = ["page", "peek", "focus"];

/** The issue the palette and issue shortcuts act on. */
export const issueInContext = (shell: Shell): string | null =>
  SOURCES.map((source) => shell.shown.get(source)).find((id) => id !== undefined) ?? null;
