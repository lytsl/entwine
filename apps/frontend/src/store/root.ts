/** One object per kind of row, each made once for the workspace. Components reach it through `useStore`. */
import type { Workspace } from "@entwine/db-collection/react";
import { Cycles } from "./cycle";
import { Attachments, Comments, Links, Reactions, Relations } from "./issue/details";
import { Issues } from "./issue/issue";
import { Subscriptions } from "./issue/subscription";
import { Labels } from "./label";
import { Members } from "./member";
import { Modules } from "./module";
import { ModuleMembers } from "./module-member";
import { Notifications } from "./notification";
import { Projects } from "./project";
import type { ChangeSource, RowStore } from "./row-store";
import { States } from "./state";
import { Views } from "./view";
import { WorkspaceDetails } from "./workspace";

export class RootStore {
  readonly members: Members;
  readonly projects: Projects;
  readonly states: States;
  readonly labels: Labels;
  readonly cycles: Cycles;
  readonly modules: Modules;
  readonly moduleMembers: ModuleMembers;
  readonly issues: Issues;
  readonly relations: Relations;
  readonly links: Links;
  readonly comments: Comments;
  readonly reactions: Reactions;
  readonly attachments: Attachments;
  readonly views: Views;
  readonly workspace: WorkspaceDetails;
  readonly notifications: Notifications;
  readonly subscriptions: Subscriptions;
  /** What components are given: a new object after every change, holding the same stores. See `Store`. */
  current!: Store;
  readonly #listeners = new Set<() => void>();
  #following: { unsubscribe(): void }[] = [];

  constructor(private readonly ws: Workspace) {
    this.members = new Members(ws);
    this.projects = new Projects(ws);
    this.states = new States(ws);
    this.labels = new Labels(ws);
    this.cycles = new Cycles(ws);
    this.modules = new Modules(ws);
    this.moduleMembers = new ModuleMembers(ws);
    this.issues = new Issues(ws, this);
    this.relations = new Relations(ws);
    this.links = new Links(ws);
    this.comments = new Comments(ws);
    this.reactions = new Reactions(ws);
    this.attachments = new Attachments(ws);
    this.views = new Views(ws);
    this.workspace = new WorkspaceDetails(ws);
    this.notifications = new Notifications(ws);
    this.subscriptions = new Subscriptions(ws);
    this.#open();
  }

  /** The store follows the collections for as long as someone listens. */
  listen = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    if (!this.#following.length) this.#open();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size) return;
      for (const following of this.#following) following.unsubscribe();
      this.#following = [];
    };
  };

  #open() {
    const { collections } = this.ws;
    const follow = <T extends { id: string }>(store: RowStore<T>, source: ChangeSource<T>, filters = true) => {
      store.clear();
      return source.subscribeChanges(
        (changes) => {
          if (!changes.length) return;
          for (const change of changes) store.apply(change);
          // The kept lists of issues were filtered with these rows.
          if (filters) this.issues.restart();
          this.#changed({});
        },
        { includeInitialState: true },
      );
    };
    this.#following = [
      follow(this.members, collections.Member),
      follow(this.projects, collections.Project),
      follow(this.states, collections.State),
      follow(this.labels, collections.Label),
      follow(this.cycles, collections.Cycle),
      follow(this.modules, collections.Module),
      follow(this.moduleMembers, collections.ModuleMember),
      follow(this.workspace, collections.Workspace),
      follow(this.notifications, collections.Notification, false),
      { unsubscribe: this.issues.listen(() => this.#changed(this.current.epoch)) },
    ];
    this.#changed({});
  }

  #changed(epoch: object) {
    const { members, projects, states, labels, cycles, modules, issues, relations, links, comments, views } = this;
    const { reactions, attachments, moduleMembers, workspace, notifications, subscriptions } = this;
    this.current = {
      epoch,
      members,
      projects,
      states,
      labels,
      cycles,
      modules,
      moduleMembers,
      issues,
      relations,
      links,
      comments,
      views,
      reactions,
      attachments,
      workspace,
      notifications,
      subscriptions,
    };
    for (const listener of this.#listeners) listener();
  }
}

/**
 * The stores as a component is given them. The object is new after every change, so that whoever depends on it works
 * its part out again; the stores in it stay the same, so they are not what a memo or an effect depends on.
 */
export type Store = Readonly<
  Pick<
    RootStore,
    | "members"
    | "projects"
    | "states"
    | "labels"
    | "cycles"
    | "modules"
    | "moduleMembers"
    | "issues"
    | "relations"
    | "links"
    | "comments"
    | "views"
    | "reactions"
    | "attachments"
    | "workspace"
    | "notifications"
    | "subscriptions"
  > & {
    /** Changes with the rows of every kind but issues: what an issue's `rev` does not count. */
    epoch: object;
  }
>;

/**
 * For `memo`: whether a component given the store has the same props, counting the store as the same while its
 * `epoch` is. It is new after every edit, so a component that shows an issue is given its `rev` as well, and one
 * that reads the issues at large is not for this.
 */
export const sameButIssues = <P extends { store: Store }>(before: P, after: P): boolean =>
  (Object.keys(after) as (keyof P)[]).every((prop) =>
    prop === "store" ? before.store.epoch === after.store.epoch : before[prop] === after[prop],
  );
