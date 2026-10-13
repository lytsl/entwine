/** Every model a client holds, in the order a bootstrap lists them. */
export const MODELS = [
  "Member",
  "Workspace",
  "Project",
  "State",
  "Label",
  "Cycle",
  "Module",
  "ModuleMember",
  "Issue",
  "IssueLabel",
  "IssueModule",
  "IssueRelation",
  "IssueLink",
  "View",
  "Comment",
  "Activity",
  "Reaction",
  "Attachment",
  "IssueSubscription",
  "Notification",
] as const;
export type ModelName = (typeof MODELS)[number];
