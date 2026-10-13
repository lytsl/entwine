import { z } from "zod";
import { id, name, time } from "../fields";

export const commentRow = z.object({
  id,
  issueId: id,
  authorId: id,
  body: name(20_000),
  createdAt: time,
  updatedAt: time,
  editedAt: time.nullable(),
});
