import { type StateGroup } from "@entwine/shared";
import { sortStates } from "../lib/state";
import { type State } from "../types/rows";
import { byProject, RowStore } from "./row-store";

export class States extends RowStore<State> {
  /** In workflow order. */
  of = (projectId: string): State[] => this.derived("of", (states) => byProject(sortStates(states)))(projectId);

  /** Ignoring case. */
  find = (projectId: string, name: string): State | undefined =>
    this.of(projectId).find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());

  /** At the end of its group. */
  create = (projectId: string, input: { name: string; color: string; group: StateGroup }) => {
    const last = Math.max(-1, ...this.of(projectId).map((s) => (s.group === input.group ? s.position : -1)));
    return this.ws.mutate(() =>
      this.ws.collections.State.insert({
        id: crypto.randomUUID(),
        projectId,
        ...input,
        name: input.name.trim(),
        position: last + 1,
      }),
    );
  };

  update = (id: string, patch: Partial<Pick<State, "name" | "color" | "group" | "position">>) =>
    this.ws.mutate(() => this.ws.collections.State.update(id, (state) => Object.assign(state, patch)));

  /**
   * Puts a state in `group` and gives that group's states the positions 0…n−1 in the order of `ids` (which includes
   * the state), in one transaction: a drag within a group, or to another one.
   */
  move = (id: string, group: StateGroup, ids: string[]) => {
    const states = this.ws.collections.State;
    return this.ws.mutate(() => {
      if (states.get(id)?.group !== group)
        states.update(id, (state) => {
          state.group = group;
        });
      ids.forEach((stateId, position) => {
        if (states.get(stateId)?.position !== position)
          states.update(stateId, (state) => {
            state.position = position;
          });
      });
    });
  };

  /** Moves the state's issues to `moveTo`, then deletes it, in one transaction. */
  delete = (id: string, moveTo: string | null) => {
    const { Issue, State } = this.ws.collections;
    const issues = Issue.toArray.filter((issue) => issue.stateId === id);
    return this.ws.mutate(() => {
      const now = Date.now();
      if (moveTo)
        for (const issue of issues)
          Issue.update(issue.id, (draft) => Object.assign(draft, { stateId: moveTo, updatedAt: now }));
      State.delete(id);
    });
  };
}
