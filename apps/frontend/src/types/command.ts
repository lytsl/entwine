import type { Workspace } from "@entwine/db-collection/react";
import type { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { CommandGroup } from "../constants/command";
import type { ShortcutId } from "../constants/shortcuts";
import type { Theme } from "../constants/theme";
import type { Store } from "../store";
import type { Issue } from "./rows";
import type { Shell, ViewControls } from "./shell";

export interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  icon: ReactNode;
  shortcut?: ShortcutId;
  keywords?: string[];
  /** Marked as the current choice, such as the layout on screen. */
  checked?: boolean;
  /** Opens choices within the palette, which stays open. */
  stays?: boolean;
  run(): void;
}

export interface CommandContext {
  ws: Workspace;
  store: Store;
  shell: Shell;
  navigate: ReturnType<typeof useNavigate>;
  workspaceSlug: string;
  projectId?: string;
  issue?: Issue;
  view?: ViewControls | null;
  theme: Theme;
}
