import type { ModelName, Row } from "@entwine/shared";
import { fail, type WriteContext } from "./rule";

export async function need<M extends ModelName>(ctx: WriteContext, model: M, id: string): Promise<Row<M>> {
  // The message is shown to a member whose edit arrived after the row was deleted: no id, the model in words.
  const name = model.replace(/(?<=[a-z])(?=[A-Z])/g, " ").toLowerCase();
  return (await ctx.writer.get(model, id)) ?? fail("not_found", `The ${name} was not found; it may have been deleted`);
}

/** A project that takes new plans and plan changes: it exists and is not archived. */
export async function activeProject(ctx: WriteContext, projectId: string): Promise<Row<"Project">> {
  const project = await need(ctx, "Project", projectId);
  if (project.archivedAt != null) fail("invalid", "The project is archived");
  return project;
}

/**
 * An archived issue is read-only, with its labels, modules, links, relations and comments, until it is restored.
 * Rows the server changes itself (a deleted parent, cycle, module or label) go through the writer, not the rules.
 */
export async function editable(ctx: WriteContext, issueId: string): Promise<Row<"Issue">> {
  const issue = await need(ctx, "Issue", issueId);
  if (issue.archivedAt != null) fail("invalid", "The issue is archived; restore it first");
  return issue;
}
