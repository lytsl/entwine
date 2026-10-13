import type { z } from "zod";
import type { ModelName } from "../constants";
import { cycleRow } from "./cycle";
import { activityRow } from "./issue/activity";
import { attachmentRow } from "./issue/attachment";
import { commentRow } from "./issue/comment";
import { issueRow } from "./issue/issue";
import { issueLinkRow } from "./issue/link";
import { reactionRow } from "./issue/reaction";
import { issueRelationRow } from "./issue/relation";
import { issueSubscriptionRow } from "./issue/subscription";
import { issueLabelRow, labelRow } from "./label";
import { memberRow } from "./member";
import { issueModuleRow, moduleMemberRow, moduleRow } from "./module";
import { notificationRow } from "./notification";
import { projectRow } from "./project";
import { stateRow } from "./state";
import { viewRow } from "./view";
import { workspaceRow } from "./workspace";

/**
 * Collections validate optimistic rows with them, and the server's write rules pick from them the fields a client
 * may set. The backend checks each against its database contract.
 */
export const rowSchemas = {
  Member: memberRow,
  Workspace: workspaceRow,
  Project: projectRow,
  State: stateRow,
  Label: labelRow,
  Cycle: cycleRow,
  Module: moduleRow,
  ModuleMember: moduleMemberRow,
  Issue: issueRow,
  IssueLabel: issueLabelRow,
  IssueModule: issueModuleRow,
  IssueRelation: issueRelationRow,
  IssueLink: issueLinkRow,
  View: viewRow,
  Comment: commentRow,
  Activity: activityRow,
  Reaction: reactionRow,
  Attachment: attachmentRow,
  IssueSubscription: issueSubscriptionRow,
  Notification: notificationRow,
} satisfies Record<ModelName, z.ZodObject>;

/** A row of `M` as it is stored, sent on the wire and held in a collection. */
export type Row<M extends ModelName> = z.infer<(typeof rowSchemas)[M]>;
export type Rows = { [M in ModelName]: Row<M> };
