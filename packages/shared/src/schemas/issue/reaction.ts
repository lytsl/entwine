import { z } from "zod";
import { REACTIONS } from "../../constants";
import { id, time } from "../fields";

/** `commentId` is null for a reaction to the issue itself. The id is `reactionId`'s. */
export const reactionRow = z.object({
  id: z.string().min(1).max(220),
  issueId: id,
  commentId: id.nullable(),
  userId: id,
  emoji: z.enum(REACTIONS),
  createdAt: time,
});
