import type { Match, Query, Row, RowMap, Select, Value, Where } from "@entwine/sync-engine/protocol";
import type { VersionedRow } from "../types/store";
import type { Collections } from "../types/workspace";
import { field, isValue, queryKey, selections } from "../utils/queries";
import type { Loader } from "./loader";
import type { Tab } from "./tab";

export class Dependents {
  constructor(
    private readonly tab: Tab,
    private readonly loader: Loader,
    private readonly collections: Collections<RowMap>,
  ) {}

  /**
   * A row that enters a held query's nested selection (an issue that joins a held project, a relation to an issue of
   * another project) brings rows the stream never sent, so the query is loaded again, narrowed to that row's value.
   * An inserted row is followed only through its references: whatever references its id is newer and comes on the
   * stream.
   */
  load(changed: Map<VersionedRow, { previous?: Row | null; inserted: boolean }>): void {
    const missing = new Map<string, Query>();
    const cache = new Map<Select, Set<unknown>>();
    for (const query of this.loader.holding())
      for (const { select, narrow } of selections(query))
        for (const [row, { previous, inserted }] of changed) {
          if (row.model !== select.model || !row.data || (inserted && select.select === "id")) continue;
          const value = field(row.data, select.select);
          if (!isValue(value) || !this.matches(select, row.data, cache)) continue;
          if (previous && field(previous, select.select) === value && this.matches(select, previous, cache)) continue;
          const narrowed = narrow(value);
          if (!this.loader.isLoaded(narrowed)) missing.set(queryKey(narrowed), narrowed);
        }
    if (missing.size) this.loader.fetchRows([...missing.values()]).catch((error) => this.tab.report(error));
  }

  /** Nested selections are answered from the rows the tab holds. */
  private matches(query: Query, row: object, cache: Map<Select, Set<unknown>>): boolean {
    const holds = (where: Where = {}) =>
      Object.entries(where).every(([name, match]) => this.holds(match, field(row, name) ?? null, cache));
    return holds(query.where) && (query.any ?? []).every((alternatives) => alternatives.some(holds));
  }

  private holds(match: Match, value: unknown, cache: Map<Select, Set<unknown>>): boolean {
    if (Array.isArray(match)) return match.includes(value as Value);
    if (!match || typeof match !== "object") return value === match;
    if ("contains" in match)
      return match.contains.every((word) => String(value).toLowerCase().includes(word.toLowerCase()));
    if ("not" in match) return !this.holds(match.not, value, cache);
    if (!("select" in match)) {
      const within = value as string | number;
      return value !== null && !(match.from !== undefined && within < match.from) && !(within > (match.to ?? within));
    }
    let values = cache.get(match);
    if (!values) {
      values = new Set();
      const collection = this.collections[match.model];
      for (const held of collection?.values() ?? [])
        if (this.matches(match, held, cache)) values.add(field(held, match.select) ?? null);
      cache.set(match, values);
    }
    return values.has(value);
  }
}
