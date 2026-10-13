import { pairId } from "@entwine/shared";
import { type Module } from "../types/rows";
import { byProject, linkIssues, RowStore } from "./row-store";

export type ModuleInput = Pick<Module, "name" | "description" | "status" | "startDate" | "targetDate">;

const link = (moduleId: string) => (issueId: string) => ({ id: pairId(issueId, moduleId), issueId, moduleId });

export class Modules extends RowStore<Module> {
  /** By name. */
  of = (projectId: string): Module[] =>
    this.derived("of", (modules) => byProject(modules.sort((a, b) => a.name.localeCompare(b.name))))(projectId);

  create = (projectId: string, input: ModuleInput): string => {
    const id = crypto.randomUUID();
    const now = Date.now();
    void this.ws.mutate(() =>
      this.ws.collections.Module.insert({
        id,
        projectId,
        ...input,
        name: input.name.trim(),
        leadId: null,
        creatorId: this.ws.userId,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return id;
  };

  update = (id: string, patch: Partial<ModuleInput & Pick<Module, "leadId">>) =>
    this.ws.mutate(() =>
      this.ws.collections.Module.update(id, (module) => Object.assign(module, patch, { updatedAt: Date.now() })),
    );

  /** The server removes the module's memberships, which reaches every client as changes. */
  delete = (id: string) => this.ws.mutate(() => this.ws.collections.Module.delete(id));

  /** Adds the issues not in the module or, when all are in it, takes them out; their other modules are untouched. */
  toggle = (issues: string | readonly string[], moduleId: string) =>
    linkIssues(this.ws, this.ws.collections.IssueModule, issues, link(moduleId), true);

  /** Keeps the modules the issues are already in. */
  add = (issueIds: readonly string[], moduleId: string) =>
    linkIssues(this.ws, this.ws.collections.IssueModule, issueIds, link(moduleId), false);
}
