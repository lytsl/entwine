import type { ModelName, Row } from "@entwine/shared";
import type { LoggedChange } from "@entwine/sync-engine";
import type { TransactionRequest } from "@entwine/sync-engine/protocol";
import { applyMutations } from "./mutations";
import { rules } from "./rules";
import { logActivity } from "./rules/shared/activity";
import { activeProject } from "./rules/shared/guards";
import { fail, type Rule, type WriteContext } from "./rules/shared/rule";

/** References checked on exact restores. Project.defaultStateId is a cycle, checked after all restores. */
const REFERENCES: Partial<Record<ModelName, Record<string, ModelName>>> = {
  Project: { defaultStateId: "State" },
  State: { projectId: "Project" },
  Cycle: { projectId: "Project", creatorId: "Member" },
  Module: { projectId: "Project", creatorId: "Member", leadId: "Member" },
  ModuleMember: { moduleId: "Module", memberId: "Member" },
  Issue: {
    projectId: "Project",
    stateId: "State",
    creatorId: "Member",
    assigneeId: "Member",
    parentId: "Issue",
    cycleId: "Cycle",
  },
  IssueLabel: { issueId: "Issue", labelId: "Label" },
  IssueModule: { issueId: "Issue", moduleId: "Module" },
  IssueRelation: { issueId: "Issue", relatedId: "Issue" },
  IssueLink: { issueId: "Issue", creatorId: "Member" },
  Comment: { issueId: "Issue", authorId: "Member" },
  Activity: { issueId: "Issue", actorId: "Member" },
  Reaction: { issueId: "Issue", commentId: "Comment", userId: "Member" },
  Attachment: { issueId: "Issue", uploaderId: "Member" },
  View: { projectId: "Project", creatorId: "Member" },
  IssueSubscription: { issueId: "Issue", memberId: "Member" },
  Notification: { issueId: "Issue", memberId: "Member", actorId: "Member" },
};

/**
 * Rows the rules write for other members as a consequence of an edit. A revert takes back the ones its transaction
 * made, and puts back the ones it removed, through the writer: they are not the actor's to write through the rules.
 */
const CONSEQUENCES: readonly ModelName[] = ["IssueSubscription", "Notification"];

type Logged = LoggedChange & { model: ModelName };

export async function applyTransaction(context: WriteContext, request: TransactionRequest): Promise<void> {
  if ("mutations" in request) return applyMutations(context, request.mutations);
  const ctx: WriteContext = { ...context, quiet: true };
  const changes = (await ctx.writer.changesOf(request.revert)) as Logged[];
  if (!changes.length) fail("conflict", "It can no longer be undone");
  if (changes.some((c) => c.actorId !== ctx.userId)) fail("forbidden", "Only your own edits can be undone");
  // Collapse multiple touches of a row to its original and final versions.
  const rows = new Map<string, Logged>();
  for (const change of changes) {
    const key = `${change.model}:${change.rowId}`;
    const first = rows.get(key);
    rows.set(key, first ? { ...change, before: first.before } : change);
  }
  const all = [...rows.values()];
  const restored = all.filter((c) => c.before && !c.data).sort((a, b) => b.id - a.id);
  const restoredProjects = new Set(restored.filter((c) => c.model === "Project").map((c) => c.rowId));
  // Prefer reverse deletion order, but a child updated and then deleted can need a parent deleted earlier.
  // The project's default state is checked afterwards: the state itself needs the project first.
  const pending = new Set(restored);
  while (pending.size) {
    let progressed = false;
    for (const c of pending) {
      const row = c.before! as unknown as Record<string, unknown>;
      let waiting = false;
      let gone = false;
      for (const [field, model] of Object.entries(REFERENCES[c.model] ?? {})) {
        if (c.model === "Project" && field === "defaultStateId") continue;
        if (!row[field] || (await ctx.writer.get(model, row[field] as string))) continue;
        if ([...pending].some((other) => other.model === model && other.rowId === row[field])) waiting = true;
        else if (CONSEQUENCES.includes(c.model)) gone = true;
        else fail("conflict", "A referenced row is gone; it can no longer be undone");
      }
      if (waiting) continue;
      const exists = await ctx.writer.get(c.model, c.rowId);
      if (exists && !CONSEQUENCES.includes(c.model)) fail("conflict", "The deleted row already exists");
      // A member who subscribed again meanwhile is subscribed. And a notification the transaction pushed out of a
      // full inbox may be of an issue deleted since: it stays out, and is no reason to refuse the member's undo.
      if (exists || gone) {
        pending.delete(c);
        if (gone) restored.splice(restored.indexOf(c), 1);
        progressed = true;
        continue;
      }
      await (rules[c.model] as Rule<ModelName> | undefined)?.restore?.(ctx, c.before! as unknown as Row<ModelName>);
      await ctx.writer.insert(c.model, c.before! as unknown as Row<ModelName>);
      pending.delete(c);
      progressed = true;
    }
    if (!progressed) fail("conflict", "The deleted rows can no longer be restored together");
  }
  for (const c of restored) {
    const row = c.before! as unknown as Record<string, unknown>;
    const refs = REFERENCES[c.model] ?? {};
    for (const [field, model] of Object.entries(refs))
      if (row[field] && !(await ctx.writer.get(model, row[field] as string)))
        fail("conflict", "A referenced row is gone; it can no longer be undone");
    if (["Issue", "Cycle", "Module", "State"].includes(c.model) && !restoredProjects.has(row.projectId as string))
      await activeProject(ctx, row.projectId as string);
    if (c.model === "Issue") await logActivity(ctx, c.rowId, "restored");
  }
  for (const c of [...all].sort((a, b) => b.id - a.id)) {
    if (!c.before || !c.data || c.model === "Activity") continue;
    const before = c.before as unknown as Record<string, unknown>;
    const after = c.data as unknown as Record<string, unknown>;
    const value = Object.fromEntries(Object.entries(before).filter(([key, value]) => value !== after[key]));
    if (!(await ctx.writer.get(c.model, c.rowId))) fail("conflict", "It can no longer be undone");
    await applyMutations(ctx, [{ model: c.model, key: c.rowId, type: "update", value }]);
  }
  for (const c of all) {
    if (c.before || !c.data || c.model === "Activity") continue;
    if (!(await ctx.writer.get(c.model, c.rowId))) continue;
    if (CONSEQUENCES.includes(c.model)) await ctx.writer.delete(c.model, c.rowId);
    else await applyMutations(ctx, [{ model: c.model, key: c.rowId, type: "delete", value: {} }]);
  }
}
