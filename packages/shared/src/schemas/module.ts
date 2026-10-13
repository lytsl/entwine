import { z } from "zod";
import { MODULE_STATUSES } from "../constants";
import { date, derivedId, description, id, name, time } from "./fields";

export const moduleRow = z.object({
  id,
  projectId: id,
  name: name(100),
  description,
  status: z.enum(MODULE_STATUSES),
  startDate: date.nullable(),
  targetDate: date.nullable(),
  leadId: id.nullable(),
  creatorId: id,
  createdAt: time,
  updatedAt: time,
});

export const moduleMemberRow = z.object({ id: derivedId, moduleId: id, memberId: id });

export const issueModuleRow = z.object({ id: derivedId, issueId: id, moduleId: id });
