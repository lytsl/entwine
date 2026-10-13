/**
 * Every binding is stated once, in `SHORTCUTS`: the key handling, the `?` list and the key hints in menus all read it.
 * Pages attach what a binding does while they are mounted (`useShortcuts`); one with nothing attached does nothing.
 *
 * Keys are in TanStack Hotkeys' notation: a key (`C`, `?`), a modified key (`Mod+K`, where `Mod` is ⌘ on macOS and
 * Ctrl elsewhere) or, for a sequence, an array of them (`["G", "P"]`), whose next key must follow within a second.
 *
 * A member can turn off the ways to press a binding that are character keys alone (`preferences/single-keys.ts`):
 * those are then not bound, and hints show the next way, or none.
 */
import type { Hotkey, HotkeySequence } from "@tanstack/react-hotkeys";

export const SHORTCUT_GROUPS = ["General", "Navigation", "Issue views", "Issue"] as const;
export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

/** A combination, or the combinations of a sequence in order. */
export type Keys = Hotkey | HotkeySequence;

export interface Binding {
  /** The first is the one shown. */
  keys: readonly Keys[];
  label: string;
  group: ShortcutGroup;
  /** Works in text fields, dialogs and menus too. */
  anywhere?: boolean;
}

const binding = (group: ShortcutGroup, label: string, keys: Keys[], anywhere = false): Binding => ({
  keys,
  label,
  group,
  anywhere,
});

export const SHORTCUTS = {
  palette: binding("General", "Open the command palette", ["Mod+K"], true),
  newIssue: binding("General", "New issue", ["C"]),
  search: binding("General", "Search the view", ["/"]),
  help: binding("General", "Keyboard shortcuts", ["?"]),
  sidebar: binding("General", "Fold the sidebar", ["Mod+B"]),
  undo: binding("General", "Undo", ["Mod+Z"]),
  redo: binding("General", "Redo", ["Mod+Shift+Z", "Mod+Y"]),

  goInbox: binding("Navigation", "Go to Inbox", [["G", "N"]]),
  goMyIssues: binding("Navigation", "Go to My issues", [["G", "Y"]]),
  goProjects: binding("Navigation", "Go to Projects", [["G", "P"]]),
  goViews: binding("Navigation", "Go to Views", [["G", "V"]]),
  goIssues: binding("Navigation", "Go to the project's issues (All issues outside a project)", [["G", "I"]]),
  goCycles: binding("Navigation", "Go to the project's cycles", [["G", "C"]]),
  goModules: binding("Navigation", "Go to the project's modules", [["G", "M"]]),
  goSettings: binding("Navigation", "Go to the project's settings", [["G", "S"]]),

  layoutList: binding("Issue views", "List layout", [["V", "L"]]),
  layoutBoard: binding("Issue views", "Board layout", [["V", "B"]]),
  layoutSpreadsheet: binding("Issue views", "Spreadsheet layout", [["V", "S"]]),
  layoutCalendar: binding("Issue views", "Calendar layout", [["V", "C"]]),
  layoutTimeline: binding("Issue views", "Timeline layout", [["V", "T"]]),
  next: binding("Issue views", "Focus the next issue", ["J", "ArrowDown"]),
  previous: binding("Issue views", "Focus the previous issue", ["K", "ArrowUp"]),
  open: binding("Issue views", "Open the focused issue", ["Enter"]),
  dismiss: binding("Issue views", "Close the preview, then clear the selection, then the focus", ["Escape"]),
  select: binding("Issue views", "Select the focused issue", ["X"]),
  selectAll: binding("Issue views", "Select every issue shown", ["Mod+A"]),

  state: binding("Issue", "Change state", ["S"]),
  priority: binding("Issue", "Change priority", ["P"]),
  assignee: binding("Issue", "Change assignee", ["A"]),
  assignMe: binding("Issue", "Assign to me, or unassign", ["I"]),
  labels: binding("Issue", "Change labels", ["L"]),
  estimate: binding("Issue", "Change estimate", ["Shift+E"]),
  cycle: binding("Issue", "Move to cycle", ["Shift+C"]),
  modules: binding("Issue", "Change modules", ["Shift+M"]),
  copyKey: binding("Issue", "Copy key", ["Mod+."]),
  copyLink: binding("Issue", "Copy link", ["Mod+Shift+,"]),
  delete: binding("Issue", "Delete issue", ["Mod+Backspace"]),
} satisfies Record<string, Binding>;

export type ShortcutId = keyof typeof SHORTCUTS;
