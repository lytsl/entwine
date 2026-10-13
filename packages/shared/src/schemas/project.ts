import { z } from "zod";
import { MAX_CYCLE_WEEKS, MAX_UPCOMING_CYCLES } from "../constants";
import { id, name, time } from "./fields";

const timezone = z
  .string()
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone");

export const projectRow = z.object({
  id,
  name: name(80),
  identifier: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,5}$/, "Use 1–5 letters or digits"),
  description: z.string().max(10_000),
  lastIssueNumber: z.number().int().min(0),
  defaultStateId: z.string().max(201),
  archivedAt: time.nullable(),
  /** The cycle schedule: null weeks for none. The server creates the cycles and, with `cycleRollover`, moves issues. */
  cycleWeeks: z.number().int().min(1).max(MAX_CYCLE_WEEKS).nullable(),
  /** 0 is Sunday. */
  cycleStartDay: z.number().int().min(0).max(6),
  cycleUpcoming: z.number().int().min(1).max(MAX_UPCOMING_CYCLES),
  cycleRollover: z.number().int().min(0).max(1),
  /** The zone whose date starts and ends the project's scheduled cycles. */
  cycleTimezone: timezone,
  createdAt: time,
  updatedAt: time,
});

/** The project form validates with it, and the write rule parses with it. */
export const projectInput = projectRow.pick({ name: true, identifier: true, description: true });

/** The schedule form validates with it, and the write rule parses with it. */
export const cycleScheduleInput = projectRow.pick({
  cycleWeeks: true,
  cycleStartDay: true,
  cycleUpcoming: true,
  cycleRollover: true,
  cycleTimezone: true,
});
