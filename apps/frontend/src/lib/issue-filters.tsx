import {
  DUE_FILTERS,
  FILTER_KEYS,
  type FilterKey,
  type IssueQuery,
  localToday,
  PRIORITIES,
  PRIORITY_LABELS,
  STATE_GROUPS,
} from "@entwine/shared";
/** The filters an issue view offers, defined once for the Filters panel and the applied-filter chips. */

import { PriorityIcon } from "@entwine/ui/components/icons/priority-icon";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { BoxIcon } from "lucide-react";
import { CycleIcon } from "../components/cycle-icon";
import { ModuleStatusIcon } from "../components/module-status-icon";
import { DUE_ICONS, DUE_LABELS } from "../constants/issue-view";
import { GROUP_LABELS } from "../constants/state";
import { type Store } from "../store";
import type { FilterDef } from "../types/issue-view";
import { cyclePhase } from "./plan";
import { toggledList } from "./toggle";

/** In the panel's order; project only where several projects are shown. */
export function filterDefs(store: Store, projectId?: string): FilterDef[] {
  const members = store.members.active.map((m) => ({
    value: m.id,
    label: m.name,
    icon: <UserAvatar user={m} size={16} />,
  }));
  const defs: FilterDef[] = [
    {
      key: "groups",
      title: "State",
      options: STATE_GROUPS.map((g) => ({
        value: g,
        label: GROUP_LABELS[g],
        icon: <StateIcon type={g} color="var(--muted-foreground)" className="size-3.5!" />,
      })),
    },
    {
      key: "priorities",
      title: "Priority",
      options: PRIORITIES.map((p) => ({
        value: p,
        label: PRIORITY_LABELS[p],
        icon: <PriorityIcon priority={p} className="size-3.5! text-muted-foreground" />,
      })),
    },
    {
      key: "assignees",
      title: "Assignee",
      options: [{ value: "none", label: "Unassigned", icon: <UserAvatar user={null} size={16} /> }, ...members],
    },
    {
      key: "labels",
      title: "Label",
      options: store.labels.sorted.map((l) => ({
        value: l.id,
        label: l.name,
        icon: <span className="size-2.5 rounded-full" style={{ background: l.color }} />,
      })),
    },
    {
      key: "due",
      title: "Due date",
      options: DUE_FILTERS.map((d) => ({ value: d, label: DUE_LABELS[d], icon: DUE_ICONS[d] })),
    },
    { key: "creators", title: "Created by", options: members },
  ];
  // Plans belong to a project: a view across projects names each plan's project.
  const plannable = projectId ? [projectId] : store.projects.active.map((p) => p.id);
  const named = (planProjectId: string, name: string) =>
    projectId ? name : `${store.projects.get(planProjectId)?.identifier} · ${name}`;
  const today = localToday();
  const cycles = plannable.flatMap((id) => store.cycles.of(id));
  if (cycles.length)
    defs.push({
      key: "cycles",
      title: "Cycle",
      options: [
        { value: "none", label: "No cycle", icon: <CycleIcon className="size-3.5" /> },
        ...cycles.map((c) => ({
          value: c.id,
          label: named(c.projectId, c.name),
          icon: <CycleIcon phase={cyclePhase(c, today)} className="size-3.5" />,
        })),
      ],
    });
  const modules = plannable.flatMap((id) => store.modules.of(id));
  if (modules.length)
    defs.push({
      key: "modules",
      title: "Module",
      options: [
        { value: "none", label: "No module", icon: <BoxIcon className="size-3.5 text-muted-foreground" /> },
        ...modules.map((m) => ({
          value: m.id,
          label: named(m.projectId, m.name),
          icon: <ModuleStatusIcon status={m.status} className="size-3.5" />,
        })),
      ],
    });
  if (!projectId)
    defs.push({
      key: "projects",
      title: "Project",
      options: store.projects.active.map((p) => ({
        value: p.id,
        label: p.name,
        icon: <ProjectIcon project={p} size={16} />,
      })),
    });
  return defs.filter((def) => def.options.length > 0);
}

/** Counts applied values, not filters. */
export const activeFilterCount = (query: IssueQuery) => FILTER_KEYS.reduce((sum, key) => sum + query[key].length, 0);

export function toggleFilter(query: IssueQuery, key: FilterKey, value: string): Partial<IssueQuery> {
  return { [key]: toggledList(query[key] as string[], value) };
}
