/**
 * The choices of each issue property, built once: the pickers, the issue menu's submenus and the palette's pages all
 * list these, so an option looks and sorts the same wherever it is chosen.
 */
import {
  CYCLE_PHASES,
  ESTIMATES,
  type ModuleStatus,
  PRIORITIES,
  PRIORITY_LABELS,
  type Priority,
} from "@entwine/shared";
import { PriorityIcon } from "@entwine/ui/components/icons/priority-icon";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import type { PropertyOption } from "@entwine/ui/components/ui/property-select";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { TriangleIcon } from "lucide-react";
import { CycleIcon } from "../components/cycle-icon";
import { ModuleStatusIcon } from "../components/module-status-icon";
import { PHASE_LABELS } from "../constants/cycle";
import { MODULE_STATUS_LABELS } from "../constants/module";
import { type Store } from "../store";
import type { Member } from "../types/rows";
import { cyclesByPhase } from "./plan";

export const stateOptions = (store: Store, projectId: string): PropertyOption<string>[] =>
  store.states.of(projectId).map((s) => ({
    value: s.id,
    label: s.name,
    icon: <StateIcon type={s.group} color={s.color} />,
  }));

export const priorityOptions = (): PropertyOption<Priority>[] =>
  PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p], icon: <PriorityIcon priority={p} /> }));

/** One who left the workspace says so: a module still lists them, to be taken off. */
export const memberOptions = (members: readonly Member[]): PropertyOption<string>[] =>
  members.map((m) => ({
    value: m.id,
    label: m.name,
    icon: <UserAvatar user={m} size={16} />,
    hint: m.removed ? "Left" : undefined,
    keywords: [m.email],
  }));

export const assigneeOptions = (store: Store): PropertyOption<string | null>[] => [
  { value: null, label: "Unassigned", icon: <UserAvatar user={null} size={16} /> },
  ...memberOptions(store.members.active),
];

export const labelOptions = (store: Store): PropertyOption<string>[] =>
  store.labels.sorted.map((label) => ({
    value: label.id,
    label: label.name,
    icon: <span className="size-2.5 rounded-full" style={{ background: label.color }} />,
  }));

export const estimateLabel = (estimate: number | null) =>
  estimate === null ? "No estimate" : `${estimate} ${estimate === 1 ? "point" : "points"}`;

export const estimateOptions = (): PropertyOption<number | null>[] =>
  [null, ...ESTIMATES].map((e) => ({
    value: e,
    label: estimateLabel(e),
    icon: <TriangleIcon className="size-3.5 text-muted-foreground" />,
  }));

/** Current cycles first, after "No cycle". */
export function cycleOptions(store: Store, projectId: string, today: string): PropertyOption<string | null>[] {
  const phases = cyclesByPhase(store.cycles.of(projectId), today);
  return [
    { value: null, label: "No cycle", icon: <CycleIcon /> },
    ...CYCLE_PHASES.flatMap((phase) =>
      phases[phase].map((c) => ({
        value: c.id,
        label: c.name,
        icon: <CycleIcon phase={phase} />,
        hint: PHASE_LABELS[phase].label,
        keywords: [PHASE_LABELS[phase].label],
      })),
    ),
  ];
}

export const moduleOptions = (store: Store, projectId: string): PropertyOption<string>[] =>
  store.modules.of(projectId).map((m) => ({
    value: m.id,
    label: m.name,
    icon: <ModuleStatusIcon status={m.status} className="size-3.5" />,
    hint: MODULE_STATUS_LABELS[m.status].label,
  }));

/** An archived project refuses cycle and module changes. */
export const plansFrozen = (store: Store, projectId: string) => store.projects.get(projectId)?.archivedAt != null;
