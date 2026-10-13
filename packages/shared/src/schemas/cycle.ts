import { z } from "zod";
import { date, description, id, name, time } from "./fields";

export const cycleRow = z.object({
  id,
  projectId: id,
  name: name(100),
  description,
  startDate: date,
  endDate: date,
  /** Null for a cycle the server created from the project's schedule. */
  creatorId: id.nullable(),
  /**
   * The unfinished issues the rollover has moved out of the cycle, and their estimate points: what it had planned
   * and did not get done, which its issues no longer say. Only the server writes them.
   */
  rolledIssues: z.number().int().min(0),
  rolledPoints: z.number().int().min(0),
  createdAt: time,
  updatedAt: time,
});
