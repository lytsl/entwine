import type { ModuleStatus } from "@entwine/shared";

export const MODULE_STATUS_LABELS: Record<ModuleStatus, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "#a3a3a2" },
  planned: { label: "Planned", color: "#3f76ff" },
  in_progress: { label: "In progress", color: "#f39e1f" },
  paused: { label: "Paused", color: "#737373" },
  completed: { label: "Completed", color: "#16a34a" },
  cancelled: { label: "Cancelled", color: "#ef4444" },
};
