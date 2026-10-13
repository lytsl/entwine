/** A cycle or a module as its form asks for it: they share a name, a description and a range of dates. */
import { z } from "zod";
import { cycleRow } from "./cycle";
import { moduleRow } from "./module";

export const planInput = z
  .object({
    name: cycleRow.shape.name,
    description: cycleRow.shape.description,
    status: moduleRow.shape.status,
    start: z.string().nullable(),
    end: z.string().nullable(),
    kind: z.enum(["cycle", "module"]),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "cycle" && !value.start)
      ctx.addIssue({ code: "custom", path: ["start"], message: "A cycle needs a start date" });
    if (value.kind === "cycle" && !value.end)
      ctx.addIssue({ code: "custom", path: ["end"], message: "A cycle needs an end date" });
    if (value.start && value.end && value.start > value.end)
      ctx.addIssue({ code: "custom", path: ["end"], message: "The end is before the start" });
  });
