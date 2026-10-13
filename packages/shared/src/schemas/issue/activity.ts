import { z } from "zod";
import { id, time } from "../fields";

export const activityRow = z.object({
  id,
  issueId: id,
  /** Null for what the server did on its own, such as a cycle rollover. */
  actorId: id.nullable(),
  field: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  createdAt: time,
});
