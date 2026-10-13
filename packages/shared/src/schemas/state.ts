import { z } from "zod";
import { STATE_GROUPS } from "../constants";
import { color, id, name } from "./fields";

export const stateRow = z.object({
  id,
  projectId: id,
  name: name(50),
  color,
  group: z.enum(STATE_GROUPS),
  position: z.number().int(),
});

export const stateInput = stateRow.pick({ name: true, color: true, group: true });
