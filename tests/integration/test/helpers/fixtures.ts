import { defaultStates, NO_CYCLE_SCHEDULE, pairId } from "@entwine/shared";
import type { Client } from "./client";

export const now = Date.now();

export function createProject(client: Client, id: string, identifier: string) {
  return client.mutate(() => {
    client.collections.Project.insert({
      id,
      name: identifier,
      identifier,
      description: "",
      lastIssueNumber: 0,
      defaultStateId: pairId(id, "backlog"),
      archivedAt: null,
      ...NO_CYCLE_SCHEDULE,
      createdAt: now,
      updatedAt: now,
    });
    for (const state of defaultStates(id)) client.collections.State.insert(state);
  });
}

/** Predicts the issue's number, as the app does. */
export function createIssue(client: Client, id: string, projectId: string, creatorId: string) {
  const project = client.collections.Project.get(projectId)!;
  return client.mutate(() => {
    client.collections.Issue.insert({
      id,
      projectId,
      number: project.lastIssueNumber + 1,
      title: `Issue ${id}`,
      description: "",
      stateId: `${projectId}:backlog`,
      priority: "none",
      assigneeId: null,
      creatorId,
      parentId: null,
      startDate: null,
      dueDate: null,
      estimate: null,
      cycleId: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    client.collections.Project.update(projectId, (p) => {
      p.lastIssueNumber += 1;
    });
  });
}
