import { ARCHIVABLE_GROUPS, issueRow, type Row } from "@entwine/shared";
import { deleteRelation } from "./issue-relation";
import { logActivity } from "./shared/activity";
import { activeProject, need } from "./shared/guards";
import { newMentions, tell } from "./shared/notify";
import { changed, fail, isAdmin, parse, type Rule, type WriteContext } from "./shared/rule";

/**
 * Dependents are deleted through the writer so that clients hear of it. Sub-issues stay, without a parent: losing
 * a subtree to one delete is worse than finding the children at the top level.
 */
export async function deleteIssueRows(ctx: WriteContext, issueId: string): Promise<void> {
  for (const child of await ctx.writer.list("Issue", { parentId: issueId })) {
    await ctx.writer.update("Issue", child.id, { parentId: null, updatedAt: ctx.now });
    await logActivity(ctx, child.id, "parentId", issueId, null);
  }
  for (const relation of [
    ...(await ctx.writer.list("IssueRelation", { issueId })),
    ...(await ctx.writer.list("IssueRelation", { relatedId: issueId })),
  ]) {
    await deleteRelation(ctx, relation, issueId);
    await ctx.writer.delete("IssueRelation", relation.id);
  }
  for (const attachment of await ctx.writer.list("Attachment", { issueId })) {
    await ctx.files.release(attachment.id);
    await ctx.writer.delete("Attachment", attachment.id);
  }
  // Reactions before the comments they may be on.
  for (const model of [
    "IssueLabel",
    "IssueModule",
    "IssueLink",
    "Reaction",
    "Comment",
    "Activity",
    "IssueSubscription",
    "Notification",
  ] as const) {
    for (const row of await ctx.writer.list(model, { issueId })) await ctx.writer.delete(model, row.id);
  }
}

const issueFields = issueRow
  .pick({
    title: true,
    description: true,
    stateId: true,
    priority: true,
    assigneeId: true,
    parentId: true,
    startDate: true,
    dueDate: true,
    estimate: true,
    cycleId: true,
  })
  .extend({ archivedAt: issueRow.shape.archivedAt });

async function checkReferences(
  ctx: WriteContext,
  issueId: string,
  projectId: string,
  patch: Partial<Row<"Issue">>,
): Promise<void> {
  if (patch.cycleId) {
    const cycle = await ctx.writer.get("Cycle", patch.cycleId);
    if (cycle?.projectId !== projectId) fail("invalid", "The cycle must be a cycle of the issue's project");
  }
  if (patch.stateId !== undefined) {
    const state = await ctx.writer.get("State", patch.stateId);
    if (state?.projectId !== projectId) fail("invalid", "The state belongs to another project");
  }
  if (patch.assigneeId) {
    const member = await ctx.writer.get("Member", patch.assigneeId);
    if (!member || member.removed) fail("invalid", "The assignee is not a member of this workspace");
  }
  if (patch.parentId) await checkParent(ctx, issueId, projectId, patch.parentId);
}

async function checkParent(ctx: WriteContext, issueId: string, projectId: string, parentId: string): Promise<void> {
  let ancestor = await ctx.writer.get("Issue", parentId);
  if (ancestor?.projectId !== projectId) fail("invalid", "The parent must be an issue of the same project");
  // Bounded, so that a corrupt chain cannot hold the write queue.
  for (let depth = 0; ancestor && depth < 1000; depth++) {
    if (ancestor.id === issueId) fail("invalid", "An issue cannot be its own parent or its descendant's sub-issue");
    ancestor = ancestor.parentId ? await ctx.writer.get("Issue", ancestor.parentId) : null;
  }
}

function checkDates(issue: Partial<Pick<Row<"Issue">, "startDate" | "dueDate">>): void {
  if (issue.startDate && issue.dueDate && issue.startDate > issue.dueDate)
    fail("invalid", "The start date is after the due date");
}

/** Activity values are ids or plain values, as strings; the timeline resolves ids to names. */
const ACTIVITY_FIELDS = [
  "title",
  "stateId",
  "priority",
  "assigneeId",
  "parentId",
  "startDate",
  "dueDate",
  "estimate",
  "cycleId",
] as const;
const activityValue = (value: string | number | null | undefined) => (value == null ? null : String(value));

export const issue: Rule<"Issue"> = {
  async insert(ctx, value) {
    const input = parse(
      issueFields
        .omit({ archivedAt: true })
        .partial({
          description: true,
          priority: true,
          assigneeId: true,
          parentId: true,
          startDate: true,
          dueDate: true,
          estimate: true,
          cycleId: true,
        })
        .extend({ id: issueRow.shape.id, projectId: issueRow.shape.projectId }),
      value,
    );
    const project = await activeProject(ctx, input.projectId);
    await checkReferences(ctx, input.id, project.id, input);
    checkDates(input);
    const number = project.lastIssueNumber + 1;
    await ctx.writer.update("Project", project.id, { lastIssueNumber: number });
    return {
      description: "",
      priority: "none",
      assigneeId: null,
      parentId: null,
      startDate: null,
      dueDate: null,
      estimate: null,
      cycleId: null,
      ...input,
      archivedAt: null,
      number,
      creatorId: ctx.userId,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    };
  },
  async afterInsert(ctx, row) {
    await logActivity(ctx, row.id, "created");
    // Module memberships made with the issue log themselves; the cycle is a field, so it is logged here.
    if (row.cycleId) await logActivity(ctx, row.id, "cycleId", null, row.cycleId);
    await tell(ctx, row.id, { actor: true, assigned: row.assigneeId, mentioned: newMentions(row.description) });
  },
  async update(ctx, current, value) {
    const input = parse(issueFields.partial(), value);
    // Clients say "archived" with any number; the time is the server's, and re-archiving keeps the first one.
    if (input.archivedAt != null) input.archivedAt = current.archivedAt ?? ctx.now;
    const patch = changed(current, input);
    if (!Object.keys(patch).length) return patch;
    // A state stays writable: deleting a state moves its issues, archived ones included, in the same transaction.
    if (current.archivedAt != null && patch.archivedAt !== null && Object.keys(patch).some((k) => k !== "stateId"))
      fail("invalid", "The issue is archived; restore it first");
    if (patch.archivedAt != null) {
      const state = await need(ctx, "State", patch.stateId ?? current.stateId);
      if (!ARCHIVABLE_GROUPS.includes(state.group))
        fail("invalid", "Only completed or cancelled issues can be archived");
    }
    // An archived project's issues stay editable, but its plans are frozen.
    if ("cycleId" in patch) await activeProject(ctx, current.projectId);
    await checkReferences(ctx, current.id, current.projectId, patch);
    checkDates({ ...current, ...patch });
    for (const field of ACTIVITY_FIELDS) {
      if (field in patch)
        await logActivity(ctx, current.id, field, activityValue(current[field]), activityValue(patch[field]));
    }
    if ("description" in patch) await logActivity(ctx, current.id, "description");
    if ("archivedAt" in patch) await logActivity(ctx, current.id, patch.archivedAt == null ? "unarchived" : "archived");
    await tell(ctx, current.id, {
      assigned: patch.assigneeId,
      mentioned: patch.description === undefined ? [] : newMentions(patch.description, current.description),
      subscribers: "stateId" in patch ? "state" : undefined,
    });
    return { ...patch, updatedAt: ctx.now };
  },
  async delete(ctx, current) {
    if (current.creatorId !== ctx.userId && !isAdmin(ctx))
      fail("forbidden", "Only its creator or an admin can delete an issue");
    await deleteIssueRows(ctx, current.id);
  },
};
