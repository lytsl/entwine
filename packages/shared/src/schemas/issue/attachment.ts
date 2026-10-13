import { z } from "zod";
import { ATTACHMENT_MAX_BYTES, FILE_NAME_UNSAFE } from "../../constants";
import { id, name, time } from "../fields";

/**
 * The id names the file on the server's disk, so it is a UUID and nothing else: in lower case, or a disk that
 * ignores case would give two rows one file.
 */
export const attachmentRow = z.object({
  id: z.uuid().lowercase("A file's id is in lower case"),
  issueId: id,
  name: name(255).refine((value) => !FILE_NAME_UNSAFE.test(value), "A file's name has no path or control characters"),
  size: z.number().int().min(1).max(ATTACHMENT_MAX_BYTES),
  uploaderId: id,
  createdAt: time,
});
