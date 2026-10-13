/** In the order a project lists them. */
export const MODULE_STATUSES = ["backlog", "planned", "in_progress", "paused", "completed", "cancelled"] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];
