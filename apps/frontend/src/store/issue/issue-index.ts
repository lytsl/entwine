/**
 * The workspace's issues, what hangs off each one (labels, modules, sub-issues, links) and how many there are of a
 * kind, kept up to date from the collections' changes: an edit moves one entry, where rebuilding the maps took a
 * pass over every row. A list row renders again only for its own issue: `rev` is what it compares. Nothing else in
 * the app holds every issue.
 */
import type { Row } from "@entwine/shared";
import type { Issue } from "../../types/rows";
import type { Change, ChangeSource } from "../row-store";

export interface IssueSources {
  Issue: ChangeSource<Issue>;
  IssueLabel: ChangeSource<Row<"IssueLabel">>;
  IssueModule: ChangeSource<Row<"IssueModule">>;
  IssueLink: ChangeSource<Row<"IssueLink">>;
}

/** Changes the index can list the issues of; a view that is further behind works its issues out again. */
const REMEMBERED = 32;
/** A change touching more issues than this (a load, a bulk edit) is not listed either. */
const LISTED = 1000;
// Typed as the arrays the store has always returned; frozen, since every issue without links shares it.
const NONE = Object.freeze([]) as unknown as string[];
const NO_COUNTS: ReadonlyMap<string, number> = new Map();

function add<K>(sets: Map<K, Set<string>>, key: K, id: string) {
  const set = sets.get(key);
  if (set) set.add(id);
  else sets.set(key, new Set([id]));
}

export class IssueIndex {
  readonly issues = new Map<string, Issue>();
  /** Counts the changes taken in. */
  version = 0;
  readonly #labels = new Map<string, string[]>();
  readonly #modules = new Map<string, string[]>();
  readonly #inModule = new Map<string, Set<string>>();
  readonly #children = new Map<string, Set<string>>();
  readonly #links = new Map<string, number>();
  /** How many issues of a project, cycle or module are in each state, and how many of them are archived. */
  readonly #states = new Map<string, Map<string, number>>();
  /** Their estimates summed the same way: an issue without one adds nothing. */
  readonly #points = new Map<string, Map<string, number>>();
  readonly #archived = new Map<string, number>();
  readonly #labelUses = new Map<string, number>();
  readonly #revs = new Map<string, number>();
  readonly #touched = new Set<string>();
  readonly #log: { version: number; ids: string[] | null }[] = [];
  readonly #listeners = new Set<() => void>();
  #subscriptions: { unsubscribe(): void }[] = [];

  constructor(private readonly sources: IssueSources) {
    this.#open();
  }

  /** The index follows the collections for as long as someone listens. */
  listen = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    if (!this.#subscriptions.length) this.#open();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size) return;
      for (const subscription of this.#subscriptions) subscription.unsubscribe();
      this.#subscriptions = [];
    };
  };

  /** Counts the changes to what a row shows of an issue: itself, its labels, modules, links and sub-issues. */
  rev(issueId: string): number {
    return this.#revs.get(issueId) ?? 0;
  }

  /** The issues touched after `version`, or null when the index no longer knows: then any may have changed. */
  touchedSince(version: number): readonly string[] | null {
    if (version === this.version) return NONE;
    const first = this.#log.findIndex((entry) => entry.version > version);
    if (first < 0 || this.#log[first]?.version !== version + 1) return null;
    const ids = new Set<string>();
    for (const entry of this.#log.slice(first)) {
      if (!entry.ids) return null;
      for (const id of entry.ids) ids.add(id);
    }
    return [...ids];
  }

  /** Has the lists look at these issues again, and tells the listeners: something outside the rows changed. */
  retouch(issueIds: Iterable<string> = []): void {
    for (const id of issueIds) this.#touch(id);
    if (this.#touched.size) this.#commit();
    else for (const listener of this.#listeners) listener();
  }

  labelsOf(issueId: string): string[] {
    return this.#labels.get(issueId) ?? NONE;
  }

  modulesOf(issueId: string): string[] {
    return this.#modules.get(issueId) ?? NONE;
  }

  inModule(moduleId: string, issueId: string): boolean {
    return !!this.#inModule.get(moduleId)?.has(issueId);
  }

  /** In no order. */
  childrenOf(issueId: string): Issue[] {
    // Most issues have none, and a list asks for every issue's.
    const ids = this.#children.get(issueId);
    return ids?.size ? this.#rows(ids) : (NONE as unknown as Issue[]);
  }

  linkCount(issueId: string): number {
    return this.#links.get(issueId) ?? 0;
  }

  /** A project's, cycle's or module's issues counted by state id, archived ones included. */
  stateCounts(holderId: string): ReadonlyMap<string, number> {
    return this.#states.get(holderId) ?? NO_COUNTS;
  }

  /** A project's, cycle's or module's estimate points summed by state id, archived issues included. */
  statePoints(holderId: string): ReadonlyMap<string, number> {
    return this.#points.get(holderId) ?? NO_COUNTS;
  }

  archivedIn(holderId: string): number {
    return this.#archived.get(holderId) ?? 0;
  }

  labelUses(labelId: string): number {
    return this.#labelUses.get(labelId) ?? 0;
  }

  #rows(ids: Set<string> | undefined): Issue[] {
    const rows: Issue[] = [];
    if (ids)
      for (const id of ids) {
        const issue = this.issues.get(id);
        if (issue) rows.push(issue);
      }
    return rows;
  }

  #open() {
    for (const map of [this.issues, this.#labels, this.#modules, this.#inModule, this.#children]) map.clear();
    for (const counts of [this.#links, this.#states, this.#points, this.#archived, this.#labelUses]) counts.clear();
    const follow = <T>(source: ChangeSource<T>, apply: (change: Change<T>) => void) =>
      source.subscribeChanges(
        (changes) => {
          for (const change of changes) apply(change);
          this.#commit();
        },
        { includeInitialState: true },
      );
    this.#subscriptions = [
      follow(this.sources.Issue, (change) => this.#issue(change)),
      follow(this.sources.IssueLabel, (change) => {
        const { issueId, labelId } = change.value;
        const step = this.#step(change.type, this.labelsOf(issueId).includes(labelId));
        if (step) this.#labelUses.set(labelId, this.labelUses(labelId) + step);
        this.#link(this.#labels, change, (row) => row.labelId);
      }),
      follow(this.sources.IssueModule, (change) => {
        // An update changes neither end: a membership's id is made of both.
        const { issueId, moduleId } = change.value;
        const step = this.#step(change.type, this.inModule(moduleId, issueId));
        if (step > 0) add(this.#inModule, moduleId, issueId);
        else if (step < 0) this.#inModule.get(moduleId)?.delete(issueId);
        // An issue that is not here yet is counted in its modules when it arrives.
        const issue = this.issues.get(issueId);
        if (step && issue) this.#countIn(moduleId, issue, step);
        this.#link(this.#modules, change, (row) => row.moduleId);
      }),
      follow(this.sources.IssueLink, (change) => {
        const { issueId } = change.value;
        const step = change.type === "insert" ? 1 : change.type === "delete" ? -1 : 0;
        this.#links.set(issueId, this.linkCount(issueId) + step);
        this.#touch(issueId);
      }),
    ];
  }

  #issue({ type, value }: Change<Issue>) {
    const before = this.issues.get(value.id);
    const after = type === "delete" ? undefined : value;
    if (after) this.issues.set(value.id, after);
    else this.issues.delete(value.id);
    if (before?.parentId !== after?.parentId) {
      if (before?.parentId) this.#children.get(before.parentId)?.delete(value.id);
      if (after?.parentId) add(this.#children, after.parentId, value.id);
    }
    if (
      before?.projectId !== after?.projectId ||
      before?.cycleId !== after?.cycleId ||
      before?.stateId !== after?.stateId ||
      before?.estimate !== after?.estimate ||
      before?.archivedAt !== after?.archivedAt
    ) {
      if (before) this.#count(before, -1);
      if (after) this.#count(after, 1);
    }
    this.#touch(value.id);
    // A parent's row counts its sub-issues and those that are done.
    for (const parentId of new Set([before?.parentId, after?.parentId])) if (parentId) this.#touch(parentId);
  }

  /** Each change makes a new array, so a control given one sees it change. */
  #link<T extends { issueId: string }>(
    links: Map<string, string[]>,
    { type, value }: Change<T>,
    linked: (row: T) => string,
  ) {
    const ids = links.get(value.issueId) ?? NONE;
    const id = linked(value);
    if (type === "insert" && !ids.includes(id)) links.set(value.issueId, [...ids, id]);
    else if (type === "delete")
      links.set(
        value.issueId,
        ids.filter((other) => other !== id),
      );
    this.#touch(value.issueId);
  }

  /** What a link's change adds to a count; `had` is whether the link was there, since a change may come twice. */
  #step(type: Change<unknown>["type"], had: boolean): number {
    return type === "insert" && !had ? 1 : type === "delete" && had ? -1 : 0;
  }

  /** Counts an issue in, or out of, its project, its cycle and its modules. */
  #count(issue: Issue, step: number) {
    this.#countIn(issue.projectId, issue, step);
    if (issue.cycleId) this.#countIn(issue.cycleId, issue, step);
    for (const moduleId of this.modulesOf(issue.id)) this.#countIn(moduleId, issue, step);
  }

  #countIn(holderId: string, { stateId, estimate, archivedAt }: Issue, step: number) {
    const counts = this.#states.get(holderId) ?? new Map<string, number>();
    this.#states.set(holderId, counts);
    counts.set(stateId, (counts.get(stateId) ?? 0) + step);
    if (estimate) {
      const points = this.#points.get(holderId) ?? new Map<string, number>();
      this.#points.set(holderId, points);
      points.set(stateId, (points.get(stateId) ?? 0) + step * estimate);
    }
    if (archivedAt !== null) this.#archived.set(holderId, this.archivedIn(holderId) + step);
  }

  #touch(issueId: string) {
    this.#revs.set(issueId, this.rev(issueId) + 1);
    this.#touched.add(issueId);
  }

  #commit() {
    if (!this.#touched.size) return;
    this.version++;
    this.#log.push({ version: this.version, ids: this.#touched.size > LISTED ? null : [...this.#touched] });
    if (this.#log.length > REMEMBERED) this.#log.shift();
    this.#touched.clear();
    for (const listener of this.#listeners) listener();
  }
}
