import { z } from "zod";
import { id, time } from "../fields";

export const issueLinkRow = z.object({
  id,
  issueId: id,
  url: z
    .string()
    .trim()
    .max(2000)
    .refine((url) => URL.canParse(url) && /^https?:$/.test(new URL(url).protocol), "Use an http or https address"),
  title: z.string().trim().max(200),
  creatorId: id,
  createdAt: time,
});

export const issueLinkInput = issueLinkRow.pick({ url: true, title: true });
