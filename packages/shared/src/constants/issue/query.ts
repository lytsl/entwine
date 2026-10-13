export const LAYOUTS = ["list", "board", "spreadsheet", "calendar", "timeline"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const GROUP_BY = ["state", "priority", "assignee", "project", "none"] as const;
export type GroupBy = (typeof GROUP_BY)[number];

export const ORDER_BY = ["priority", "created", "updated", "due"] as const;
export type OrderBy = (typeof ORDER_BY)[number];

/** What rows, cards and spreadsheet columns show besides the title. */
export const DISPLAY_PROPERTIES = [
  "key",
  "state",
  "priority",
  "assignee",
  "labels",
  "startDate",
  "dueDate",
  "estimate",
  "subIssues",
  "links",
  "cycle",
  "modules",
] as const;
export type DisplayProperty = (typeof DISPLAY_PROPERTIES)[number];

/** `week` is due from today through the next six days. */
export const DUE_FILTERS = ["overdue", "week", "none"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

/** The filters of a query, which "clear" resets. */
export const FILTER_KEYS = [
  "groups",
  "priorities",
  "assignees",
  "labels",
  "projects",
  "creators",
  "due",
  "cycles",
  "modules",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
