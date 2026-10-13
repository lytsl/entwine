import {
  type GroupBy,
  type IssueQuery,
  PRIORITIES,
  PRIORITY_LABELS,
  STATE_GROUPS,
  type StateGroup,
} from "@entwine/shared";
import { PriorityIcon } from "@entwine/ui/components/icons/priority-icon";
import { ProjectIcon } from "@entwine/ui/components/icons/project-icon";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { GROUP_LABELS } from "../constants/state";
import { type IssuePatch, type Store } from "../store";
import type { Group } from "../types/issue-view";
import { type Issue } from "../types/rows";
import type { NewIssueDefaults } from "../types/shell";

type GroupSpec = Omit<Group, "issues">;

function groupKey(by: GroupBy, store: Store, projectId?: string): (issue: Issue) => string | undefined {
  switch (by) {
    case "state":
      return projectId ? (issue) => issue.stateId : (issue) => store.states.get(issue.stateId)?.group;
    case "priority":
      return (issue) => issue.priority;
    case "assignee":
      return (issue) => issue.assigneeId ?? "none";
    case "project":
      return (issue) => issue.projectId;
    case "none":
      return () => "all";
  }
}

/** In order, limited by the query's filter on the grouped property. */
function groupSpecs(by: GroupBy, query: IssueQuery, store: Store, issues: Issue[], projectId?: string): GroupSpec[] {
  const allowed = <T,>(filter: readonly T[], value: T) => !filter.length || filter.includes(value);
  const inProject = (seed: NewIssueDefaults) => (projectId ? { projectId, ...seed } : undefined);
  switch (by) {
    case "state":
      if (projectId)
        return store.states
          .of(projectId)
          .filter((s) => allowed(query.groups, s.group))
          .map((s) => ({
            key: s.id,
            name: s.name,
            icon: <StateIcon type={s.group} color={s.color} />,
            patch: () => ({ stateId: s.id }),
            seed: { projectId, stateId: s.id },
          }));
      // Across projects, states merge by group; a drop picks the group's first state in the issue's project.
      return STATE_GROUPS.filter((g) => allowed(query.groups, g)).map((group) => ({
        key: group,
        name: GROUP_LABELS[group],
        icon: <StateIcon type={group} color="var(--muted-foreground)" />,
        patch: (issue) => {
          const state = store.states.of(issue.projectId).find((s) => s.group === group);
          return state ? { stateId: state.id } : null;
        },
      }));
    case "priority":
      return PRIORITIES.filter((p) => allowed(query.priorities, p)).map((priority) => ({
        key: priority,
        name: PRIORITY_LABELS[priority],
        icon: <PriorityIcon priority={priority} className="text-muted-foreground" />,
        patch: () => ({ priority }),
        seed: inProject({ priority }),
      }));
    case "assignee": {
      // Removed members keep a group while issues still name them, but take no new issues.
      const ids = new Set(store.members.active.map((m) => m.id));
      const removed = [...new Set(issues.map((i) => i.assigneeId))].filter(
        (id): id is string => id !== null && !ids.has(id),
      );
      const members = [...store.members.active, ...removed.map((id) => store.members.get(id)).filter((m) => !!m)];
      return [
        ...members.map((m) => ({
          key: m.id,
          name: m.name,
          icon: <UserAvatar user={m} size={16} />,
          patch: ids.has(m.id) ? () => ({ assigneeId: m.id }) : undefined,
          seed: ids.has(m.id) ? inProject({ assigneeId: m.id }) : undefined,
        })),
        {
          key: "none",
          name: "No assignee",
          icon: <UserAvatar user={null} size={16} />,
          patch: () => ({ assigneeId: null }),
          seed: inProject({ assigneeId: null }),
        },
      ].filter((g) => allowed(query.assignees, g.key));
    }
    case "project":
      // An issue keeps its project for life, so project groups take no drops; they do take new issues.
      return store.projects.sorted
        .filter((p) => (query.projects.length ? query.projects.includes(p.id) : p.archivedAt === null))
        .map((p) => ({
          key: p.id,
          name: p.name,
          icon: <ProjectIcon project={p} size={16} />,
          seed: p.archivedAt === null ? { projectId: p.id } : undefined,
        }));
    case "none":
      return [{ key: "all", name: "All issues", seed: inProject({}) }];
  }
}

export function groupIssues(
  by: GroupBy,
  query: IssueQuery,
  store: Store,
  issues: Issue[],
  projectId?: string,
): Group[] {
  const groups: Group[] = groupSpecs(by, query, store, issues, projectId).map((group) => ({ ...group, issues: [] }));
  // One pass over the issues, whatever the number of groups.
  const lists = new Map(groups.map((group) => [group.key, group.issues]));
  const keyOf = groupKey(by, store, projectId);
  for (const issue of issues) lists.get(keyOf(issue) ?? "")?.push(issue);
  return query.emptyGroups ? groups : groups.filter((g) => g.issues.length);
}

/** Null when dropping `issue` on `group` changes nothing. */
export function dropPatch(group: Group, issue: Issue): IssuePatch | null {
  const patch = group.patch?.(issue);
  if (!patch) return null;
  return Object.entries(patch).some(([key, value]) => issue[key as keyof Issue] !== value) ? patch : null;
}

export const canQuickAdd = (seed: NonNullable<Group["seed"]>, store: Store) =>
  store.projects.get(seed.projectId)?.archivedAt === null;
