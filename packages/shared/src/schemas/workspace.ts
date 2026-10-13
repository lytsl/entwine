import { z } from "zod";
import { RESERVED_SLUGS } from "../constants";
import { id, name } from "./fields";

/** A workspace's slug is its address: `/<slug>`. */
export const workspaceSlug = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "2–40 lowercase letters, digits or dashes")
  .refine((slug) => !RESERVED_SLUGS.includes(slug), "That URL is reserved; choose another");

export const workspaceName = name(80);

export const workspaceInput = z.object({ name: workspaceName, slug: workspaceSlug });
/** A workspace's slug is not among what can be changed: links and invitations hold it. */
export const workspaceRenameInput = workspaceInput.pick({ name: true });

/** The one row of a workspace about itself, under the workspace's id. */
export const workspaceRow = z.object({ id, name: z.string() });
