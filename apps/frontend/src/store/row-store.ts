import type { Workspace } from "@entwine/db-collection/react";

export interface Change<T> {
  type: "insert" | "update" | "delete";
  value: T;
  previousValue?: T;
}

/** What a store needs of a TanStack DB collection to follow it. */
export interface ChangeSource<T> {
  subscribeChanges(
    listener: (changes: Change<T>[]) => void,
    options: { includeInitialState: boolean },
  ): { unsubscribe(): void };
}

/**
 * The rows of one kind, kept from their collection's changes, and the base of that kind's store: one per workspace.
 * Its methods are properties, so one can be handed on alone.
 */
export class RowStore<T extends { id: string }> {
  /** The same map throughout, changed in place. */
  readonly rows = new Map<string, T>();
  readonly #derived = new Map<string, unknown>();

  constructor(protected readonly ws: Workspace) {}

  get = (id: string): T | undefined => this.rows.get(id);
  has = (id: string): boolean => this.rows.has(id);

  /** What was derived from the rows is worked out again when next asked. */
  apply({ type, value }: Change<T>): void {
    if (type === "delete") this.rows.delete(value.id);
    else this.rows.set(value.id, value);
    this.#derived.clear();
  }

  clear(): void {
    this.rows.clear();
    this.#derived.clear();
  }

  /** What `make` says of the rows, under `name`: the same value until a row changes, as a MobX `computed` is. */
  protected derived<V>(name: string, make: (rows: T[]) => V): V {
    if (!this.#derived.has(name)) this.#derived.set(name, make([...this.rows.values()]));
    return this.#derived.get(name) as V;
  }
}

/**
 * A project's rows, in the order `rows` are in, worked out once for all projects. A project's array is the same one
 * at every call.
 */
export function byProject<T extends { projectId: string }>(rows: readonly T[]): (projectId: string) => T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.projectId);
    if (group) group.push(row);
    else groups.set(row.projectId, [row]);
  }
  return (projectId) => groups.get(projectId) ?? [];
}

/**
 * Links each issue to a label or module, by the row `link` makes for it, in one transaction: issues already linked
 * are left alone. With `toggle`, issues that all have the link lose it instead.
 */
export function linkIssues<T extends { id: string }>(
  ws: Workspace,
  collection: { has(id: string): boolean; insert(row: NoInfer<T>): unknown; delete(id: string): unknown },
  issues: string | readonly string[],
  link: (issueId: string) => T,
  toggle: boolean,
) {
  const rows = (typeof issues === "string" ? [issues] : issues).map(link);
  const all = toggle && rows.every((row) => collection.has(row.id));
  return ws.mutate(() => {
    for (const row of rows) {
      if (all) collection.delete(row.id);
      else if (!collection.has(row.id)) collection.insert(row);
    }
  });
}
