import { defaultStates, NO_CYCLE_SCHEDULE, pairId } from "@entwine/shared";
import { type Project } from "../types/rows";
import { RowStore } from "./row-store";

/** The server creates the cycles a schedule asks for, which reach every client as changes. */
export type CycleSchedule = Pick<
  Project,
  "cycleWeeks" | "cycleStartDay" | "cycleUpcoming" | "cycleRollover" | "cycleTimezone"
>;

export class Projects extends RowStore<Project> {
  /** By name. */
  get sorted(): Project[] {
    return this.derived("sorted", (projects) => projects.sort((a, b) => a.name.localeCompare(b.name)));
  }

  /** Not archived, by name: the ones the sidebar and pickers offer. */
  get active(): Project[] {
    return this.derived("active", () => this.sorted.filter((p) => p.archivedAt === null));
  }

  create = (input: { name: string; identifier: string; description: string }): string => {
    const { ws } = this;
    const id = crypto.randomUUID();
    const now = Date.now();
    void ws.mutate(() => {
      ws.collections.Project.insert({
        id,
        ...input,
        lastIssueNumber: 0,
        defaultStateId: pairId(id, "backlog"),
        archivedAt: null,
        ...NO_CYCLE_SCHEDULE,
        createdAt: now,
        updatedAt: now,
      });
      for (const state of defaultStates(id)) ws.collections.State.insert(state);
    });
    return id;
  };

  update = (
    id: string,
    patch: Partial<
      Pick<Project, "name" | "identifier" | "description" | "defaultStateId" | "archivedAt"> & CycleSchedule
    >,
  ) =>
    this.ws.mutate(() =>
      this.ws.collections.Project.update(id, (p) => Object.assign(p, patch, { updatedAt: Date.now() })),
    );

  /** The server records when. */
  setArchived = (id: string, archived: boolean) => this.update(id, { archivedAt: archived ? Date.now() : null });

  /** The server deletes the project's states and issues, which reach every client as changes. */
  delete = (id: string) => this.ws.mutate(() => this.ws.collections.Project.delete(id));
}
