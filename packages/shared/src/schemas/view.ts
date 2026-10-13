import { z } from "zod";
import { id, name, time } from "./fields";

export const viewRow = z.object({
  id,
  name: name(100),
  projectId: id.nullable(),
  /** The JSON of an `IssueQuery`; the server checks it with `isIssueQuery`. */
  query: z.string().max(20_000),
  creatorId: id,
  createdAt: time,
  updatedAt: time,
});

export const viewNameInput = viewRow.pick({ name: true });
