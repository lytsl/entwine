import { type Cycle } from "../types/rows";
import { byProject, RowStore } from "./row-store";

export type CycleInput = Pick<Cycle, "name" | "description" | "startDate" | "endDate">;

export class Cycles extends RowStore<Cycle> {
  /** By start date. */
  of = (projectId: string): Cycle[] =>
    this.derived("of", (cycles) =>
      byProject(cycles.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name))),
    )(projectId);

  create = (projectId: string, input: CycleInput): string => {
    const id = crypto.randomUUID();
    const now = Date.now();
    void this.ws.mutate(() =>
      this.ws.collections.Cycle.insert({
        id,
        projectId,
        ...input,
        name: input.name.trim(),
        creatorId: this.ws.userId,
        rolledIssues: 0,
        rolledPoints: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return id;
  };

  update = (id: string, patch: Partial<CycleInput>) =>
    this.ws.mutate(() =>
      this.ws.collections.Cycle.update(id, (cycle) => Object.assign(cycle, patch, { updatedAt: Date.now() })),
    );

  /** The server takes the cycle's issues out of it, which reaches every client as changes. */
  delete = (id: string) => this.ws.mutate(() => this.ws.collections.Cycle.delete(id));
}
