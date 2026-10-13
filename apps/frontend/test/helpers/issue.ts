import type { Row } from "@entwine/shared";

/** `i7` is number 7, created at 7: a higher number is a newer issue. */
export const issue = (id: string, patch: Partial<Row<"Issue">> = {}): Row<"Issue"> => ({
  id,
  projectId: "p1",
  number: Number(id.slice(1)),
  title: `Issue ${id}`,
  description: "",
  stateId: "todo",
  priority: "none",
  assigneeId: null,
  creatorId: "ada",
  parentId: null,
  startDate: null,
  dueDate: null,
  estimate: null,
  cycleId: null,
  archivedAt: null,
  createdAt: Number(id.slice(1)),
  updatedAt: 0,
  ...patch,
});
