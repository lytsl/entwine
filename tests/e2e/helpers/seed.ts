/** The rows both scale audits seed, whatever carries them to the server. */

import { addDays, defaultStates, PRIORITIES, pairId, STATE_GROUPS } from "@entwine/shared";
import type { Mutation } from "@entwine/sync-engine/protocol";

/** Today where the audits' browsers are: seeded dates are counted from it. */
export const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

/** Padded so that titles sort as numbers do. */
export const auditTitle = (n: number, digits: number) => `Audit issue ${String(n).padStart(digits, "0")}`;

export const insert = (model: string, value: Record<string, unknown>): Mutation => ({
  model,
  type: "insert",
  key: String(value.id),
  value,
});

/** Four labels, the projects with their default states, and a cycle and a module in each project. */
export function planning(projectCount: number, description: string) {
  const labels = Array.from({ length: 4 }, (_, n) => ({
    id: crypto.randomUUID(),
    name: `Audit label ${n}`,
    color: "#5e6ad2",
  }));
  const projects = Array.from({ length: projectCount }, (_, n) => ({
    id: crypto.randomUUID(),
    name: `Audit project ${n}`,
    identifier: `AUD${n}`,
    description,
  }));
  const cycles = projects.map((p, n) => ({
    id: crypto.randomUUID(),
    projectId: p.id,
    name: `Audit cycle ${n}`,
    startDate: addDays(today, -14),
    endDate: addDays(today, 14),
  }));
  const modules = projects.map((p, n) => ({
    id: crypto.randomUUID(),
    projectId: p.id,
    name: `Audit module ${n}`,
    status: "planned",
  }));
  return {
    labels,
    projects,
    cycles,
    modules,
    mutations: [
      ...labels.map((l) => insert("Label", l)),
      ...projects.flatMap((p) => [insert("Project", p), ...defaultStates(p.id).map((s) => insert("State", s))]),
      ...cycles.map((c) => insert("Cycle", c)),
      ...modules.map((m) => insert("Module", m)),
    ],
  };
}

/** Every property cycles with a period of its own, so each filter and grouping has a known count. */
export function issue(
  i: number,
  {
    labels,
    projects,
    cycles,
    modules,
    members,
    perProject,
    title,
  }: Pick<ReturnType<typeof planning>, "labels" | "projects" | "cycles" | "modules"> & {
    members: string[];
    perProject: number;
    title: string;
  },
): { id: string; mutations: Mutation[] } {
  const projectIndex = Math.floor(i / perProject);
  const p = projects[projectIndex];
  const id = crypto.randomUUID();
  const dueDate = i % 7 === 0 ? null : addDays(today, (i % 61) - 30);
  const mutations = [
    insert("Issue", {
      id,
      projectId: p.id,
      title,
      stateId: `${p.id}:${STATE_GROUPS[i % 5]}`,
      priority: PRIORITIES[Math.floor(i / 5) % 5],
      assigneeId: [...members, null][Math.floor(i / 25) % 4],
      startDate: dueDate ? addDays(dueDate, -3) : null,
      dueDate,
      estimate: [null, 1, 2, 3, 5, 8, 13][i % 7],
      cycleId: i % 3 === 0 ? null : cycles[projectIndex].id,
    }),
  ];
  if (i % 4 !== 0)
    mutations.push(insert("IssueLabel", { id: pairId(id, labels[i % 4].id), issueId: id, labelId: labels[i % 4].id }));
  if (i % 3 !== 0)
    mutations.push(
      insert("IssueModule", {
        id: pairId(id, modules[projectIndex].id),
        issueId: id,
        moduleId: modules[projectIndex].id,
      }),
    );
  return { id, mutations };
}
