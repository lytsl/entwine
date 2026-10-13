import { type Row, STATE_GROUPS } from "@entwine/shared";

/** Workflow order: by group, then position; ties by id, so the order is stable. */
export const sortStates = <T extends Pick<Row<"State">, "id" | "group" | "position">>(states: readonly T[]): T[] =>
  [...states].sort(
    (a, b) =>
      STATE_GROUPS.indexOf(a.group) - STATE_GROUPS.indexOf(b.group) ||
      a.position - b.position ||
      a.id.localeCompare(b.id),
  );
