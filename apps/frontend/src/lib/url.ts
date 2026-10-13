import { DEFAULT_QUERY, type IssueQuery, readQuery } from "@entwine/shared";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { z } from "zod";

export const issueUrl = (workspaceSlug: string, issueId: string) =>
  `${location.origin}/${workspaceSlug}/issues/${issueId}`;

/** `next` is the address in the app to go to once signed in; `email` fills in the form, as an invitation's link does. */
export const nextSearch = z.object({
  next: z.string().startsWith("/").catch("/").default("/"),
  email: z.string().optional().catch(undefined),
});

export type ViewSearch = IssueQuery & { peek?: string };

/** The partial input type keeps the search optional in links to the page. */
export const querySearch =
  (defaults: IssueQuery = DEFAULT_QUERY) =>
  (search: Partial<ViewSearch> & SearchSchemaInput): ViewSearch => ({
    ...readQuery(search, defaults),
    ...(typeof search.peek === "string" && search.peek ? { peek: search.peek } : {}),
  });
