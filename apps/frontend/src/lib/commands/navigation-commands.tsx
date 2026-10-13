import {
  ArchiveIcon,
  BellIcon,
  BellRingIcon,
  BoxIcon,
  FolderKanbanIcon,
  InboxIcon,
  IterationCcwIcon,
  LayersIcon,
  SettingsIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
  ViewIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ShortcutId } from "../../constants/shortcuts";
import type { Command, CommandContext } from "../../types/command";
import type { Project } from "../../types/rows";

export function navigationCommands({ navigate, workspaceSlug }: CommandContext, project?: Project): Command[] {
  const commands: Command[] = [];
  const go =
    (to: string, params: Record<string, string> = {}) =>
    () =>
      void navigate({ to, params: { workspaceSlug, ...params } });
  const nav = (id: string, label: string, icon: ReactNode, run: () => void, shortcut?: ShortcutId) =>
    commands.push({ id, group: "Navigation", label, icon, shortcut, keywords: ["go to", "open"], run });
  nav("go-inbox", "Inbox", <BellIcon />, go("/$workspaceSlug/inbox"), "goInbox");
  nav("go-my-issues", "My issues", <InboxIcon />, go("/$workspaceSlug"), "goMyIssues");
  nav("go-all-issues", "All issues", <LayersIcon />, go("/$workspaceSlug/issues"), project ? undefined : "goIssues");
  nav("go-views", "Views", <ViewIcon />, go("/$workspaceSlug/views"), "goViews");
  nav("go-projects", "Projects", <FolderKanbanIcon />, go("/$workspaceSlug/projects"), "goProjects");
  nav("go-members", "Members", <UsersIcon />, go("/$workspaceSlug/settings/members"));
  nav("go-labels", "Labels", <TagIcon />, go("/$workspaceSlug/settings/labels"));
  nav("go-general", "Workspace settings", <SettingsIcon />, go("/$workspaceSlug/settings/general"));
  nav("go-profile", "Profile", <UserIcon />, go("/$workspaceSlug/settings/profile"));
  nav(
    "go-notification-settings",
    "Notification settings",
    <BellRingIcon />,
    go("/$workspaceSlug/settings/notifications"),
  );
  if (project) {
    const params = { projectId: project.id };
    nav(
      "go-project-issues",
      `${project.name} issues`,
      <LayersIcon />,
      go("/$workspaceSlug/projects/$projectId", params),
      "goIssues",
    );
    nav(
      "go-cycles",
      `${project.name} cycles`,
      <IterationCcwIcon />,
      go("/$workspaceSlug/projects/$projectId/cycles", params),
      "goCycles",
    );
    nav(
      "go-modules",
      `${project.name} modules`,
      <BoxIcon />,
      go("/$workspaceSlug/projects/$projectId/modules", params),
      "goModules",
    );
    nav(
      "go-archives",
      `${project.name} archives`,
      <ArchiveIcon />,
      go("/$workspaceSlug/projects/$projectId/archives", params),
    );
    nav(
      "go-settings",
      `${project.name} settings`,
      <SettingsIcon />,
      go("/$workspaceSlug/projects/$projectId/settings", params),
      "goSettings",
    );
  }

  return commands;
}
