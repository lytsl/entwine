import { z } from "zod";
import { ROLES } from "../constants";
import { email } from "./auth";
import { id } from "./fields";

export const memberRow = z.object({
  id,
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.enum(ROLES),
  removed: z.number().int(),
});

export const inviteInput = z.object({ email, role: z.enum(ROLES) });
