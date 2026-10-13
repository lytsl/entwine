import { issueKey, type Row, type Rows } from "@entwine/shared";
import type { Tenant } from "@entwine/sync-engine";
import type { MailIssue } from "../mail/components/issue-card";
import type { MailUpdate } from "../mail/components/update-item";
import { plainText } from "../mail/plain-text";

export interface Described {
  issue: MailIssue;
  project: string;
  /** By notification id; a notification whose issue is gone has none. */
  updates: Map<string, { update: MailUpdate; completed: boolean }>;
}

type Rowed<M extends keyof Rows> = Row<M>[];

/**
 * What notifications say, by issue id. A notification names no comment or state change, but it was written in the
 * same edit, at the same time and by the same actor: that is how its words are found.
 */
export async function describe(
  tenant: Tenant<Rows>,
  notifications: Row<"Notification">[],
): Promise<Map<string, Described>> {
  const issueIds = [...new Set(notifications.map((n) => n.issueId))];
  const first = await tenant.load([
    { model: "Issue", where: { id: issueIds } },
    { model: "IssueLabel", where: { issueId: issueIds } },
    { model: "Comment", where: { issueId: issueIds } },
    { model: "Activity", where: { issueId: issueIds, field: "stateId" } },
  ]);
  const issues = (first.rows.Issue ?? []) as Rowed<"Issue">;
  const issueLabels = (first.rows.IssueLabel ?? []) as Rowed<"IssueLabel">;
  const comments = (first.rows.Comment ?? []) as Rowed<"Comment">;
  const activity = (first.rows.Activity ?? []) as Rowed<"Activity">;
  const second = await tenant.load([
    { model: "Project", where: { id: [...new Set(issues.map((i) => i.projectId))] } },
    { model: "Label", where: { id: [...new Set(issueLabels.map((l) => l.labelId))] } },
    {
      model: "State",
      where: {
        id: [
          ...new Set([...issues.map((i) => i.stateId), ...activity.flatMap((a) => [a.oldValue, a.newValue])]),
        ].filter((id) => id !== null),
      },
    },
    { model: "Member" },
  ]);
  const byId = <T extends { id: string }>(rows: unknown) => new Map(((rows ?? []) as T[]).map((row) => [row.id, row]));
  const projects = byId<Row<"Project">>(second.rows.Project);
  const labels = byId<Row<"Label">>(second.rows.Label);
  const states = byId<Row<"State">>(second.rows.State);
  const members = byId<Row<"Member">>(second.rows.Member);
  const name = (id: string | null) => (id ? (members.get(id)?.name ?? "Someone") : "Someone");

  const described = new Map<string, Described>();
  for (const issue of issues) {
    const project = projects.get(issue.projectId);
    const state = states.get(issue.stateId);
    if (!project || !state) continue;
    described.set(issue.id, {
      project: project.name,
      issue: {
        id: issue.id,
        key: issueKey(project, issue),
        title: issue.title,
        state: { name: state.name, color: state.color },
        priority: issue.priority as MailIssue["priority"],
        assignee: issue.assigneeId ? name(issue.assigneeId) : undefined,
        labels: issueLabels
          .filter((l) => l.issueId === issue.id)
          .flatMap((l) => labels.get(l.labelId) ?? [])
          .map((label) => ({ name: label.name, color: label.color })),
        dueDate: issue.dueDate,
      },
      updates: new Map(),
    });
  }

  for (const n of notifications) {
    const entry = described.get(n.issueId);
    if (!entry) continue;
    const update: MailUpdate = { actor: name(n.actorId), kind: n.kind };
    let completed = false;
    const by = (row: { createdAt: number }) => row.createdAt === n.createdAt;
    if (n.kind === "commented" || n.kind === "mentioned") {
      // A mention is in a new comment, an edited one, or the issue's description.
      const comment = comments.find(
        (c) => c.issueId === n.issueId && c.authorId === n.actorId && (by(c) || c.editedAt === n.createdAt),
      );
      const issue = issues.find((i) => i.id === n.issueId);
      const text =
        comment?.body ?? (n.kind === "mentioned" && issue?.updatedAt === n.createdAt ? issue.description : "");
      if (text) update.text = plainText(text);
    } else if (n.kind === "state") {
      const change = activity.find((a) => a.issueId === n.issueId && a.actorId === n.actorId && by(a));
      const to = change?.newValue ? states.get(change.newValue) : undefined;
      update.from = change?.oldValue ? states.get(change.oldValue)?.name : undefined;
      update.to = to?.name;
      completed = to?.group === "completed";
    }
    entry.updates.set(n.id, { update, completed });
  }
  return described;
}
