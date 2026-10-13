import { z } from "zod";
import { ESTIMATES, PRIORITIES } from "../../constants";
import { date, description, id, name, time } from "../fields";

const TITLE_MAX = 500;

export const issueRow = z.object({
  id,
  projectId: id,
  number: z.number().int(),
  title: name(TITLE_MAX),
  description,
  stateId: id,
  priority: z.enum(PRIORITIES),
  assigneeId: id.nullable(),
  creatorId: id,
  parentId: id.nullable(),
  startDate: date.nullable(),
  dueDate: date.nullable(),
  estimate: z
    .number()
    .int()
    .refine((n) => (ESTIMATES as readonly number[]).includes(n), `An estimate is one of ${ESTIMATES.join(", ")}`)
    .nullable(),
  cycleId: id.nullable(),
  archivedAt: time.nullable(),
  createdAt: time,
  updatedAt: time,
});

const datesInOrder = (issue: { startDate: string | null; dueDate: string | null }) =>
  !issue.startDate || !issue.dueDate || issue.startDate <= issue.dueDate;
const DATES_OUT_OF_ORDER = { path: ["dueDate"], message: "The start date is after the due date." };

const issueFields = issueRow
  .pick({
    projectId: true,
    description: true,
    stateId: true,
    priority: true,
    assigneeId: true,
    parentId: true,
    startDate: true,
    dueDate: true,
    estimate: true,
    cycleId: true,
  })
  .extend({ labelIds: z.array(id), moduleIds: z.array(id) });

/** A new issue while it is being written: checked at every change, before a title is asked for. */
export const issueDraftInput = issueFields.extend({ title: z.string() }).refine(datesInOrder, DATES_OUT_OF_ORDER);

export const issueInput = issueFields
  .extend({ title: name(TITLE_MAX, "A title is required") })
  .refine(datesInOrder, DATES_OUT_OF_ORDER);
