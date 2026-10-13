import type { DisplayProperty, DueFilter, GroupBy, Layout, OrderBy } from "@entwine/shared";
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarOffIcon,
  CalendarXIcon,
  ChartGanttIcon,
  ListIcon,
  SquareKanbanIcon,
  Table2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { ShortcutId } from "./shortcuts";

export const LAYOUT_OPTIONS: Record<Layout, { label: string; icon: ReactNode }> = {
  list: { label: "List", icon: <ListIcon /> },
  board: { label: "Board", icon: <SquareKanbanIcon /> },
  spreadsheet: { label: "Spreadsheet", icon: <Table2Icon /> },
  calendar: { label: "Calendar", icon: <CalendarDaysIcon /> },
  timeline: { label: "Timeline", icon: <ChartGanttIcon /> },
};

export const LAYOUT_SHORTCUTS = {
  list: "layoutList",
  board: "layoutBoard",
  spreadsheet: "layoutSpreadsheet",
  calendar: "layoutCalendar",
  timeline: "layoutTimeline",
} as const satisfies Record<Layout, ShortcutId>;

export const SELECTABLE_LAYOUTS: readonly Layout[] = ["list", "board", "spreadsheet"];

/** Rows rendered beyond each edge of the viewport. */
export const OVERSCAN = 10;

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A day's width on the timeline, in pixels. */
export const SCALES = { week: 60, month: 20, quarter: 5 } as const;
export type Scale = keyof typeof SCALES;

export const DUE_LABELS: Record<DueFilter, string> = { overdue: "Overdue", week: "Due this week", none: "No due date" };
export const DUE_ICONS: Record<DueFilter, ReactNode> = {
  overdue: <CalendarXIcon className="size-3.5 text-destructive" />,
  week: <CalendarClockIcon className="size-3.5 text-muted-foreground" />,
  none: <CalendarOffIcon className="size-3.5 text-muted-foreground" />,
};

export const GROUP_BY_LABELS: Record<GroupBy, string> = {
  state: "State",
  priority: "Priority",
  assignee: "Assignee",
  project: "Project",
  none: "No grouping",
};

export const ORDER_BY_LABELS: Record<OrderBy, string> = {
  priority: "Priority",
  created: "Newest",
  updated: "Last updated",
  due: "Due date",
};

export const PROPERTY_LABELS: Record<DisplayProperty, string> = {
  key: "Key",
  state: "State",
  priority: "Priority",
  assignee: "Assignee",
  labels: "Labels",
  startDate: "Start date",
  dueDate: "Due date",
  estimate: "Estimate",
  subIssues: "Sub-issues",
  links: "Links",
  cycle: "Cycle",
  modules: "Modules",
};
