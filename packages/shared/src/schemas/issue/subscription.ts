import { z } from "zod";
import { derivedId, id, time } from "../fields";

/** A member who follows an issue. The id is issueId:memberId, so a member follows an issue at most once. */
export const issueSubscriptionRow = z.object({
  id: derivedId,
  issueId: id,
  memberId: id,
  createdAt: time,
});
