import { expect, test } from "bun:test";
import { MODELS, syncSchema } from "../../src";

test("every model is synced: the directory at once, issues per scope, history per issue", () => {
  expect(Object.keys(syncSchema.models).sort()).toEqual([...MODELS].sort());
  const byLoad = (load: string) => MODELS.filter((m) => syncSchema.models[m].load === load);
  expect(byLoad("explicit")).toEqual(["Issue", "IssueLabel", "IssueModule", "IssueRelation", "IssueLink"]);
  expect(byLoad("on-demand")).toEqual(["Comment", "Activity", "Reaction", "Attachment", "IssueSubscription"]);
  // Only notifications are one member's alone.
  expect(MODELS.filter((m) => syncSchema.models[m].owner)).toEqual(["Notification"]);
  expect(syncSchema.models.Notification).toMatchObject({ load: "instant", owner: "memberId" });
});
