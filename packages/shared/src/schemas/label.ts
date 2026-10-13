import { z } from "zod";
import { color, derivedId, id, name, time } from "./fields";

export const labelRow = z.object({ id, name: name(50), nameKey: z.string(), color, createdAt: time });

export const labelInput = labelRow.pick({ name: true, color: true });

export const issueLabelRow = z.object({ id: derivedId, issueId: id, labelId: id });
