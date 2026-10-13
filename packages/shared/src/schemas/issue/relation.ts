import { z } from "zod";
import { RELATION_TYPES } from "../../constants";
import { derivedId, id, time } from "../fields";

export const issueRelationRow = z.object({
  id: derivedId,
  issueId: id,
  relatedId: id,
  type: z.enum(RELATION_TYPES),
  createdAt: time,
});
