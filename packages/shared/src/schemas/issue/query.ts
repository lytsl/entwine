/** The URL holds a view's query, saved views store it as JSON, and the server validates those with this schema. */

import { z } from "zod";
import {
  DISPLAY_PROPERTIES,
  DUE_FILTERS,
  GROUP_BY,
  LAYOUTS,
  ORDER_BY,
  PRIORITIES,
  STATE_GROUPS,
} from "../../constants";

const ids = z.array(z.string().min(1).max(100)).max(200).default([]);

export const issueQuery = z.object({
  layout: z.enum(LAYOUTS).default("list"),
  group: z.enum(GROUP_BY).default("state"),
  order: z.enum(ORDER_BY).default("priority"),
  subIssues: z.boolean().default(true),
  emptyGroups: z.boolean().default(true),
  properties: z.array(z.enum(DISPLAY_PROPERTIES)).default([...DISPLAY_PROPERTIES]),
  q: z.string().max(200).default(""),
  groups: z.array(z.enum(STATE_GROUPS)).default([]),
  priorities: z.array(z.enum(PRIORITIES)).default([]),
  /** Member ids, or "none" for unassigned. */
  assignees: ids,
  labels: ids,
  projects: ids,
  creators: ids,
  due: z.array(z.enum(DUE_FILTERS)).default([]),
  /** Cycle ids, or "none" for issues in no cycle. */
  cycles: ids,
  /** Module ids, or "none" for issues in no module. */
  modules: ids,
});
export type IssueQuery = z.output<typeof issueQuery>;

export const DEFAULT_QUERY: IssueQuery = issueQuery.parse({});
