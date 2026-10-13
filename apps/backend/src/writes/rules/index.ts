import type { ModelName } from "@entwine/shared";
import { attachment } from "./attachment";
import { comment } from "./comment";
import { cycle } from "./cycle";
import { issue } from "./issue";
import { issueLink } from "./issue-link";
import { issueRelation } from "./issue-relation";
import { issueSubscription } from "./issue-subscription";
import { issueLabel, label } from "./label";
import { issueModule, moduleMember, projectModule } from "./module";
import { notification } from "./notification";
import { project } from "./project";
import { reaction } from "./reaction";
import type { Rule } from "./shared/rule";
import { state } from "./state";
import { view } from "./view";

/**
 * Models without an entry, and operations a rule leaves out, are refused. Members, the workspace's own row and
 * activity are server-written.
 */
export const rules: { [M in ModelName]?: Rule<M> } = {
  Project: project,
  State: state,
  Label: label,
  Cycle: cycle,
  Module: projectModule,
  ModuleMember: moduleMember,
  Issue: issue,
  IssueLabel: issueLabel,
  IssueModule: issueModule,
  IssueRelation: issueRelation,
  IssueLink: issueLink,
  View: view,
  Comment: comment,
  Reaction: reaction,
  Attachment: attachment,
  IssueSubscription: issueSubscription,
  Notification: notification,
};
