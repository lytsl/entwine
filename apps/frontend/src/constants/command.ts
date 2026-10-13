import { LAYOUT_SHORTCUTS } from "./issue-view";
import type { ShortcutId } from "./shortcuts";

/** In the order the palette lists them. */
export const COMMAND_GROUPS = ["Issue", "Navigation", "Create", "Layout", "Preferences", "Help"] as const;
export type CommandGroup = (typeof COMMAND_GROUPS)[number];

export const COMMAND_SHORTCUTS: ShortcutId[] = [
  "newIssue",
  "help",
  "goInbox",
  "goMyIssues",
  "goProjects",
  "goViews",
  "goIssues",
  "goCycles",
  "goModules",
  "goSettings",
  ...Object.values(LAYOUT_SHORTCUTS),
  "state",
  "priority",
  "assignee",
  "assignMe",
  "labels",
  "estimate",
  "cycle",
  "modules",
  "copyKey",
  "copyLink",
  "delete",
];
