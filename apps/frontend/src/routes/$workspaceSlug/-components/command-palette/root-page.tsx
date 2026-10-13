import { useRows } from "@entwine/db-collection/react";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { CommandGroup, CommandShortcut } from "@entwine/ui/components/ui/command";
import { Spinner } from "@entwine/ui/components/ui/spinner";
import { BoxIcon, ViewIcon } from "lucide-react";
import { CycleIcon } from "../../../../components/cycle-icon";
import { type COMMAND_GROUPS } from "../../../../constants/command";
import { useFoundIssues } from "../../../../hooks/use-found-issues";
import { buildCommands } from "../../../../lib/commands/build-commands";
import { matches } from "../../../../lib/search";
import { type CommandContext, type Command as PaletteCommand } from "../../../../types/command";
import { PaletteItem } from "./palette-item";
import { ShortcutKeys } from "./shortcut-keys";

const RESULTS = 8;

export function RootPage({
  search,
  ctx,
  onClose,
  onCommand,
}: {
  search: string;
  ctx: CommandContext;
  onClose(): void;
  onCommand(command: PaletteCommand): void;
}) {
  const { store, shell, navigate, workspaceSlug, issue } = ctx;
  const { found: issues, ready } = useFoundIssues(store, search, RESULTS);
  const views = useRows("View");
  const commands = buildCommands(ctx).filter((c) => matches(search, [c.label, c.group, ...(c.keywords ?? [])]));
  const searching = search.trim() !== "";
  const open = (go: () => Promise<void>) => {
    onClose();
    void go();
  };

  const found = <T,>(rows: T[], texts: (row: T) => string[]) =>
    searching ? rows.filter((row) => matches(search, texts(row))).slice(0, RESULTS) : [];
  const active = (projectId: string) => store.projects.get(projectId)?.archivedAt === null;
  const projects = found(store.projects.active, (p) => [p.name, p.identifier]);
  const cycles = found(
    [...store.cycles.rows.values()].filter((c) => active(c.projectId)),
    (c) => [c.name, store.projects.get(c.projectId)?.identifier ?? ""],
  );
  const modules = found(
    [...store.modules.rows.values()].filter((m) => active(m.projectId)),
    (m) => [m.name, store.projects.get(m.projectId)?.identifier ?? ""],
  );
  const savedViews = found(views, (v) => [v.name]);
  const identifier = (projectId: string) => (
    <span className="text-caption text-muted-foreground">{store.projects.get(projectId)?.identifier}</span>
  );

  const commandGroup = (group: (typeof COMMAND_GROUPS)[number]) => {
    const items = commands.filter((c) => c.group === group);
    if (items.length === 0) return null;
    const heading = group === "Issue" && issue ? `${store.issues.key(issue)} ${issue.title}` : group;
    return (
      <CommandGroup key={group} heading={heading}>
        {items.map((command) => (
          <PaletteItem
            key={command.id}
            icon={command.icon}
            checked={command.checked}
            onSelect={() => onCommand(command)}
            hint={
              command.shortcut && (
                <CommandShortcut aria-hidden className="tracking-normal">
                  <ShortcutKeys id={command.shortcut} />
                </CommandShortcut>
              )
            }
          >
            {command.label}
          </PaletteItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <>
      {commandGroup("Issue")}
      {searching && (issues.length > 0 || !ready) && (
        <CommandGroup heading="Issues">
          {issues.map(({ issue: i, excerpt }) => {
            const state = store.states.get(i.stateId);
            return (
              <PaletteItem
                key={i.id}
                icon={state && <StateIcon type={state.group} color={state.color} />}
                onSelect={() => {
                  onClose();
                  const peek = shell.peek.current;
                  if (peek) peek(i.id);
                  else
                    void navigate({ to: "/$workspaceSlug/issues/$issueId", params: { workspaceSlug, issueId: i.id } });
                }}
              >
                <span className="mr-2 text-caption font-medium text-muted-foreground tabular-nums">
                  {store.issues.key(i)}
                </span>
                {i.title}
                {excerpt && <span className="ml-2 text-caption text-muted-foreground">{excerpt}</span>}
              </PaletteItem>
            );
          })}
          {!ready && (
            <div role="status" className="flex items-center gap-2 px-2 py-1.5 text-body text-muted-foreground">
              <Spinner className="size-3.5" />
              Searching issues…
            </div>
          )}
        </CommandGroup>
      )}
      {commandGroup("Navigation")}
      {commandGroup("Create")}
      {commandGroup("Layout")}
      {projects.length > 0 && (
        <CommandGroup heading="Projects">
          {projects.map((p) => (
            <PaletteItem
              key={p.id}
              icon={<ProjectIcon project={p} size={16} />}
              hint={identifier(p.id)}
              onSelect={() =>
                open(() =>
                  navigate({ to: "/$workspaceSlug/projects/$projectId", params: { workspaceSlug, projectId: p.id } }),
                )
              }
            >
              {p.name}
            </PaletteItem>
          ))}
        </CommandGroup>
      )}
      {cycles.length > 0 && (
        <CommandGroup heading="Cycles">
          {cycles.map((c) => (
            <PaletteItem
              key={c.id}
              icon={<CycleIcon />}
              hint={identifier(c.projectId)}
              onSelect={() =>
                open(() =>
                  navigate({
                    to: "/$workspaceSlug/projects/$projectId/cycles/$cycleId",
                    params: { workspaceSlug, projectId: c.projectId, cycleId: c.id },
                  }),
                )
              }
            >
              {c.name}
            </PaletteItem>
          ))}
        </CommandGroup>
      )}
      {modules.length > 0 && (
        <CommandGroup heading="Modules">
          {modules.map((m) => (
            <PaletteItem
              key={m.id}
              icon={<BoxIcon />}
              hint={identifier(m.projectId)}
              onSelect={() =>
                open(() =>
                  navigate({
                    to: "/$workspaceSlug/projects/$projectId/modules/$moduleId",
                    params: { workspaceSlug, projectId: m.projectId, moduleId: m.id },
                  }),
                )
              }
            >
              {m.name}
            </PaletteItem>
          ))}
        </CommandGroup>
      )}
      {savedViews.length > 0 && (
        <CommandGroup heading="Views">
          {savedViews.map((v) => (
            <PaletteItem
              key={v.id}
              icon={<ViewIcon />}
              onSelect={() =>
                open(() => navigate({ to: "/$workspaceSlug/views/$viewId", params: { workspaceSlug, viewId: v.id } }))
              }
            >
              {v.name}
            </PaletteItem>
          ))}
        </CommandGroup>
      )}
      {commandGroup("Preferences")}
      {commandGroup("Help")}
    </>
  );
}
