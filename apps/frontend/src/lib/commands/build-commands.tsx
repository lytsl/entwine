/**
 * Everything the palette offers besides search results, and what the global and issue shortcuts do: each command is
 * stated once here, with its shortcut, and built when it is needed, from where the member is.
 */
import { LAYOUTS } from "@entwine/shared";
import {
  BoxIcon,
  FolderPlusIcon,
  IterationCcwIcon,
  KeyboardIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  SquarePenIcon,
  SunIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { LAYOUT_OPTIONS, LAYOUT_SHORTCUTS } from "../../constants/issue-view";
import type { ShortcutId } from "../../constants/shortcuts";
import { THEME_LABELS, THEMES, type Theme } from "../../constants/theme";
import { setTheme } from "../../preferences/theme";
import type { Command, CommandContext } from "../../types/command";
import { issueCommands } from "./issue-commands";
import { navigationCommands } from "./navigation-commands";

const THEME_ICONS: Record<Theme, ReactNode> = { light: <SunIcon />, dark: <MoonIcon />, system: <MonitorIcon /> };

export function buildCommands(ctx: CommandContext): Command[] {
  const { store, shell, projectId, issue, view } = ctx;
  const project = projectId ? store.projects.get(projectId) : undefined;
  const commands: Command[] = [...(issue ? issueCommands(ctx, issue) : []), ...navigationCommands(ctx, project)];

  const create = (id: string, label: string, icon: ReactNode, run: () => void, shortcut?: ShortcutId) =>
    commands.push({ id, group: "Create", label, icon, shortcut, keywords: ["create", "add"], run });
  create("new-issue", "New issue", <SquarePenIcon />, () => shell.openNewIssue(), "newIssue");
  create("new-project", "New project", <FolderPlusIcon />, () => shell.openCreate("project"));
  create("new-view", "New view", <PlusIcon />, () => shell.openCreate("view"));
  if (project && project.archivedAt === null) {
    create("new-cycle", "New cycle", <IterationCcwIcon />, () => shell.openCreate("cycle", project.id));
    create("new-module", "New module", <BoxIcon />, () => shell.openCreate("module", project.id));
  }

  if (view)
    for (const layout of LAYOUTS)
      commands.push({
        id: `layout-${layout}`,
        group: "Layout",
        label: `${LAYOUT_OPTIONS[layout].label} layout`,
        icon: LAYOUT_OPTIONS[layout].icon,
        shortcut: LAYOUT_SHORTCUTS[layout],
        keywords: ["switch layout", "view"],
        checked: view.layout === layout,
        run: () => view.setLayout(layout),
      });

  for (const theme of THEMES)
    commands.push({
      id: `theme-${theme}`,
      group: "Preferences",
      label: `${THEME_LABELS[theme]} theme`,
      icon: THEME_ICONS[theme],
      keywords: ["theme", "appearance", "color"],
      checked: ctx.theme === theme,
      run: () => setTheme(theme),
    });

  commands.push({
    id: "shortcuts",
    group: "Help",
    label: "Keyboard shortcuts",
    icon: <KeyboardIcon />,
    shortcut: "help",
    keywords: ["keys", "help"],
    run: () => shell.openShortcuts(),
  });
  return commands;
}
