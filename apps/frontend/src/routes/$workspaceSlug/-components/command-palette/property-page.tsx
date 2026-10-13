import type { Priority } from "@entwine/shared";
import { CommandGroup } from "@entwine/ui/components/ui/command";
import type { PropertyOption } from "@entwine/ui/components/ui/property-select";
import { useToday } from "../../../../hooks/use-today";
import {
  assigneeOptions,
  cycleOptions,
  estimateOptions,
  labelOptions,
  moduleOptions,
  priorityOptions,
  stateOptions,
} from "../../../../lib/issue-options";
import { matches } from "../../../../lib/search";
import type { IssuePatch } from "../../../../store";
import type { CommandContext } from "../../../../types/command";
import type { PalettePage } from "../../../../types/shell";
import { PaletteItem } from "./palette-item";

export function PropertyPage({
  page,
  search,
  ctx,
  onClose,
}: {
  page: Exclude<PalettePage, "root">;
  search: string;
  ctx: CommandContext;
  onClose(): void;
}) {
  const { store, issue } = ctx;
  const today = useToday();
  if (!issue) return null;
  const set = (patch: IssuePatch) => {
    onClose();
    void store.issues.update(issue.id, patch);
  };
  const list = <T extends string | number | null>(
    options: PropertyOption<T>[],
    selected: (value: T) => boolean,
    choose: (value: T) => void,
  ) =>
    options
      .filter((o) => matches(search, [o.label, ...(o.keywords ?? [])]))
      .map((o) => (
        <PaletteItem
          key={String(o.value)}
          icon={o.icon}
          checked={selected(o.value)}
          hint={o.hint && <span className="text-caption text-muted-foreground">{o.hint}</span>}
          onSelect={() => choose(o.value)}
        >
          {o.label}
        </PaletteItem>
      ));
  const labels = store.issues.labelsOf(issue.id);
  const modules = store.issues.modulesOf(issue.id);
  const items = {
    state: () =>
      list(
        stateOptions(store, issue.projectId),
        (v) => v === issue.stateId,
        (stateId) => set({ stateId }),
      ),
    priority: () =>
      list(
        priorityOptions(),
        (v) => v === issue.priority,
        (priority: Priority) => set({ priority }),
      ),
    assignee: () =>
      list(
        assigneeOptions(store),
        (v) => v === issue.assigneeId,
        (assigneeId) => set({ assigneeId }),
      ),
    labels: () =>
      list(
        labelOptions(store),
        (v) => labels.includes(v),
        (labelId) => void store.labels.toggle(issue.id, labelId),
      ),
    estimate: () =>
      list(
        estimateOptions(),
        (v) => v === issue.estimate,
        (estimate) => set({ estimate }),
      ),
    cycle: () =>
      list(
        cycleOptions(store, issue.projectId, today),
        (v) => v === issue.cycleId,
        (cycleId) => set({ cycleId }),
      ),
    modules: () =>
      list(
        moduleOptions(store, issue.projectId),
        (v) => modules.includes(v),
        (moduleId) => void store.modules.toggle(issue.id, moduleId),
      ),
  }[page]();
  return <CommandGroup heading={`${store.issues.key(issue)} ${issue.title}`}>{items}</CommandGroup>;
}
