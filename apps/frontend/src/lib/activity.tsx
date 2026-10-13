import { PRIORITY_LABELS, type Priority, type RelationSide, type Row, type StateGroup } from "@entwine/shared";
import { PriorityIcon } from "@entwine/ui/components/icons/priority-icon";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import {
  ArrowLeftRightIcon,
  BoxIcon,
  CalendarIcon,
  FileTextIcon,
  IterationCcwIcon,
  LinkIcon,
  NetworkIcon,
  PencilIcon,
  PlusIcon,
  TagIcon,
  TriangleIcon,
  UserIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { SIDE_LABELS } from "../constants/relation";
import { type Store } from "../store";
import { estimateLabel } from "./issue-options";

/** What the server did on its own, such as a cycle rollover, has no actor. */
export const actorName = (activity: Row<"Activity">, store: Store): string =>
  activity.actorId === null ? "entwine" : (store.members.get(activity.actorId)?.name ?? "Someone");

export function describe(activity: Row<"Activity">, store: Store): string {
  const { field, oldValue: from, newValue: to } = activity;
  const state = (id: string | null) => (id ? (store.states.get(id)?.name ?? "a deleted state") : "none");
  const member = (id: string | null) => (id && store.members.get(id)?.name) || "nobody";
  const label = (id: string | null) => (id && store.labels.get(id)?.name) || "a deleted label";
  const cycle = (id: string | null) => (id && store.cycles.get(id)?.name) || "a deleted cycle";
  const module = (id: string | null) => (id && store.modules.get(id)?.name) || "a deleted module";
  const issue = (id: string | null) => {
    const found = id ? store.issues.get(id) : undefined;
    return found ? store.issues.key(found) : "a deleted issue";
  };
  /** Relation values are `side:issueId`, from this issue's side. */
  const relation = (value: string) => {
    const [side, id] = value.split(":") as [RelationSide, string];
    return `${SIDE_LABELS[side].toLowerCase()} ${issue(id)}`;
  };
  switch (field) {
    case "restored":
      return "restored the issue";
    case "created":
      return "created the issue";
    case "archived":
      return "archived the issue";
    case "unarchived":
      return "restored the issue from the archive";
    case "title":
      return `renamed the issue to “${to}”`;
    case "description":
      return "updated the description";
    case "stateId":
      return `changed state from ${state(from)} to ${state(to)}`;
    case "priority":
      return `changed priority from ${PRIORITY_LABELS[from as Priority]} to ${PRIORITY_LABELS[to as Priority]}`;
    case "assigneeId":
      return to ? `assigned the issue to ${member(to)}` : `unassigned ${member(from)}`;
    case "dueDate":
      return to ? `set the due date to ${to}` : "removed the due date";
    case "startDate":
      return to ? `set the start date to ${to}` : "removed the start date";
    case "estimate":
      return to ? `set the estimate to ${estimateLabel(Number(to))}` : "removed the estimate";
    case "parentId":
      return to ? `made this a sub-issue of ${issue(to)}` : `removed the parent ${issue(from)}`;
    case "relation":
      return to ? `marked this issue as ${relation(to)}` : `removed the relation: ${relation(from ?? "")}`;
    case "link":
      return to ? `added the link ${to}` : `removed the link ${from}`;
    case "label":
      return to ? `added the label ${label(to)}` : `removed the label ${label(from)}`;
    case "cycleId":
      if (!to) return `removed the issue from the cycle ${cycle(from)}`;
      return from
        ? `moved the issue from the cycle ${cycle(from)} to ${cycle(to)}`
        : `added the issue to the cycle ${cycle(to)}`;
    case "module":
      return to ? `added the issue to the module ${module(to)}` : `removed the issue from the module ${module(from)}`;
    default:
      return `changed ${field}`;
  }
}

/** The icon of a change: the new state or priority itself where there is one. */
export function activityIcon(activity: Row<"Activity">, store: Store): ReactNode {
  switch (activity.field) {
    case "created":
      return <PlusIcon />;
    case "stateId": {
      const state = activity.newValue ? store.states.get(activity.newValue) : undefined;
      return state ? <StateIcon type={state.group} color={state.color} className="size-3.5!" /> : null;
    }
    case "priority":
      return <PriorityIcon priority={(activity.newValue ?? "none") as Priority} className="size-3.5!" />;
    case "assigneeId":
      return <UserIcon />;
    case "dueDate":
    case "startDate":
      return <CalendarIcon />;
    case "estimate":
      return <TriangleIcon />;
    case "parentId":
      return <NetworkIcon />;
    case "relation":
      return <ArrowLeftRightIcon />;
    case "link":
      return <LinkIcon />;
    case "label":
      return <TagIcon />;
    case "cycleId":
      return <IterationCcwIcon />;
    case "module":
      return <BoxIcon />;
    case "description":
      return <FileTextIcon />;
    default:
      return <PencilIcon />;
  }
}
