/**
 * What a page across projects holds of the workspace's issues: the first of its question in its order, as many as
 * were asked for, with what a list shows of each. The server answers a question once. From then on the stream brings
 * every issue that changes, so the part held stays the server's answer as long as each issue the stream brings is
 * made whole: an issue that arrives alone has labels, modules and sub-issues the tab never saw.
 */
import type { Workspace } from "@entwine/db-collection/react";
import { issueRowQueries } from "@entwine/shared";
import type { Issue } from "../../types/rows";
import type { IssueIndex } from "./issue-index";

/** Issues asked for at a time. */
export const PAGE = 100;
/** The most one load asks for. */
const MOST = 1000;
/** Pages kept at once, the ones watched last. */
const KEPT = 12;

type Query = Parameters<Workspace["find"]>[0][number];

interface IssuePage {
  /** How many issues the server had for the question. */
  total: number;
  /** The last issue loaded, as it was then: the list ends at its place while the server has more. */
  edge: Issue | null;
  loading: boolean;
  error?: Error;
}

interface Kept extends IssuePage {
  issues: Query;
  loaded: number;
  /** The server is asked again before the page is trusted: the tab stopped following it, or could not. */
  stale: boolean;
  watchers: number;
  asking?: object;
}

export class IssuePages {
  /** Issues held with their labels, modules, links and sub-issues. */
  readonly #whole = new Set<string>();
  readonly #kept = new Map<string, Kept>();
  /** Requests of this store on their way, and the issues they have brought so far. */
  #finding = 0;
  #brought = new Set<string>();
  #seen: number;
  #rebuilds: number;

  constructor(
    private readonly ws: Pick<Workspace, "find" | "isLoaded" | "rebuilds">,
    private readonly index: IssueIndex,
  ) {
    this.#seen = index.version;
    this.#rebuilds = ws.rebuilds;
  }

  whole = (issueId: string): boolean => this.#whole.has(issueId);

  /** An issue this tab made has nothing the tab did not give it. */
  made(issueId: string): void {
    this.#whole.add(issueId);
  }

  get = (key: string): IssuePage | undefined => this.#kept.get(key);

  /** Keeps the page of `issues` for as long as it is watched, asking the server when it has no trusted answer. */
  watch(key: string, issues: Query): () => void {
    this.settle();
    let page = this.#kept.get(key);
    if (!page) {
      page = { issues, total: 0, edge: null, loading: false, loaded: 0, stale: true, watchers: 0 };
      this.#kept.set(key, page);
      for (const [other, { watchers }] of this.#kept) {
        if (this.#kept.size <= KEPT) break;
        if (!watchers) this.#kept.delete(other);
      }
    }
    page.issues = issues;
    page.watchers++;
    if (page.stale) void this.#ask(page, 0);
    return () => {
      if (--page.watchers) return;
      // Nothing makes the issues whole that arrive while no page is watched.
      page.stale = true;
      page.asking = undefined;
      page.loading = false;
    };
  }

  /** `shown` issues are on the page: the server's next ones follow them. */
  more(key: string, shown: number): void {
    const page = this.#kept.get(key);
    if (page?.edge && !page.loading) void this.#ask(page, shown);
  }

  /** The rows the questions were asked of changed (a state's group, an archived project): they are asked again. */
  expire(): void {
    for (const page of this.#kept.values()) {
      page.stale = true;
      if (page.watchers) void this.#ask(page, 0);
    }
  }

  /** After the issues changed: makes whole the ones that arrived alone, or asks again when it cannot tell which. */
  settle(): void {
    if (this.ws.rebuilds !== this.#rebuilds) {
      this.#rebuilds = this.ws.rebuilds;
      this.#whole.clear();
      this.#seen = this.index.version;
      return this.expire();
    }
    // What a request of this store brings did not arrive alone: told apart once the request has ended.
    if (this.#finding) return;
    const touched = this.index.touchedSince(this.#seen);
    this.#seen = this.index.version;
    const brought = this.#brought;
    this.#brought = new Set();
    if (![...this.#kept.values()].some((page) => page.watchers)) return;
    if (!touched) return this.expire();
    const { index } = this;
    // A touched issue the tab has nothing of is a parent whose sub-issue changed: no list shows it.
    const alone = touched.filter(
      (id) =>
        !this.#whole.has(id) &&
        !brought.has(id) &&
        (index.issues.has(id) || index.labelsOf(id).length > 0 || index.modulesOf(id).length > 0),
    );
    if (alone.length > MOST) return this.expire();
    if (alone.length) void this.#complete(alone);
  }

  /** Asks the server, and has `settle` leave the issues it brings to the caller. */
  async #find(queries: Query[]): Promise<Issue[]> {
    this.#finding++;
    try {
      const issues = ((await this.ws.find(queries)).rows.Issue ?? []) as Issue[];
      for (const issue of issues) this.#brought.add(issue.id);
      return issues;
    } finally {
      this.#finding--;
    }
  }

  async #complete(ids: string[]): Promise<void> {
    const { ws, index } = this;
    // A project loaded whole brought its issues' rows with them.
    const missing = ids.filter((id) => {
      const issue = index.issues.get(id);
      return !issue || !ws.isLoaded({ model: "Issue", where: { projectId: issue.projectId } });
    });
    const rebuilds = this.#rebuilds;
    try {
      if (missing.length) await this.#find([{ model: "Issue", where: { id: missing } }, ...issueRowQueries(missing)]);
    } catch {
      return this.expire();
    }
    if (rebuilds !== ws.rebuilds) return;
    const held = ids.filter((id) => index.issues.has(id));
    for (const id of held) this.#whole.add(id);
    index.retouch(held);
  }

  /** From the first issue, as many as were loaded before; or the next ones after `offset`. */
  async #ask(page: Kept, offset: number): Promise<void> {
    const { index } = this;
    const asking = {};
    page.asking = asking;
    page.loading = true;
    page.error = undefined;
    index.retouch();
    const limit = offset ? PAGE : Math.min(MOST, Math.max(PAGE, Math.ceil(page.loaded / PAGE) * PAGE));
    const { model, where, any } = page.issues;
    let shown: string[] | undefined;
    this.#finding++;
    try {
      const answer = await this.ws.find([
        { ...page.issues, limit, offset },
        { model, where, any, count: [] },
      ]);
      const issues = (answer.rows.Issue ?? []) as Issue[];
      const ids = issues.map((issue) => issue.id);
      for (const id of ids) this.#brought.add(id);
      if (ids.length) await this.#find(issueRowQueries(ids));
      if (page.asking !== asking) return;
      for (const id of ids) this.#whole.add(id);
      page.total = answer.counts?.[1]?.[0]?.count ?? 0;
      page.loaded = offset + ids.length;
      page.edge = ids.length === limit && page.loaded < page.total ? { ...(issues.at(-1) as Issue) } : null;
      page.stale = false;
      shown = ids;
    } catch (error) {
      if (page.asking !== asking) return;
      page.error = error as Error;
      shown = [];
    } finally {
      this.#finding--;
    }
    page.loading = false;
    index.retouch(shown);
  }
}
