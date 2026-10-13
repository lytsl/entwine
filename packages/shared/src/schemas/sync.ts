import type { LoadStrategy, Schema } from "@entwine/sync-engine/protocol";
import { MODELS, type ModelName } from "../constants";
import { type Rows, rowSchemas } from "./rows";

/**
 * The directory and configuration come with the bootstrap, and issues load per project. An issue's history loads
 * when the issue is opened: every edit writes activity, so it grows fastest, and nothing outside its page reads it.
 * Its reactions and attachments load with it, for the same reason.
 * A member's notifications come with the bootstrap, for the unread count; the server keeps them few.
 */
const LOAD: Record<ModelName, LoadStrategy> = {
  Member: "instant",
  Workspace: "instant",
  Project: "instant",
  State: "instant",
  Label: "instant",
  Cycle: "instant",
  Module: "instant",
  ModuleMember: "instant",
  View: "instant",
  Issue: "explicit",
  IssueLabel: "explicit",
  IssueModule: "explicit",
  IssueRelation: "explicit",
  IssueLink: "explicit",
  Comment: "on-demand",
  Activity: "on-demand",
  Reaction: "on-demand",
  Attachment: "on-demand",
  IssueSubscription: "on-demand",
  Notification: "instant",
};

/** The field that names the one member a model's rows are for; no other member is sent them. */
const OWNER: Partial<Record<ModelName, string>> = { Notification: "memberId" };

/** A hash of every model's fields and load strategy: stored rows of another shape are dropped. */
function version(): string {
  const text = MODELS.map(
    (m) => `${m}:${LOAD[m]}${OWNER[m] ? `@${OWNER[m]}` : ""}:${Object.keys(rowSchemas[m].shape).join(",")}`,
  ).join("|");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

export const syncSchema: Schema<Rows> = {
  version: version(),
  models: Object.fromEntries(
    MODELS.map((model) => [model, { load: LOAD[model], schema: rowSchemas[model], owner: OWNER[model] }]),
  ) as unknown as Schema<Rows>["models"],
};
