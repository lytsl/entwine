import type { ModuleStatus, StateGroup } from "@entwine/shared";
import { StateIcon } from "@entwine/ui/components/icons/state-icon";
import { MODULE_STATUS_LABELS } from "../constants/module";

/** A module's status is drawn as the workflow state it resembles. */
const STATUS_SHAPE: Record<ModuleStatus, StateGroup> = {
  backlog: "backlog",
  planned: "unstarted",
  in_progress: "started",
  paused: "unstarted",
  completed: "completed",
  cancelled: "cancelled",
};

export function ModuleStatusIcon({ status, className }: { status: ModuleStatus; className?: string }) {
  return (
    <span aria-hidden className="flex shrink-0">
      <StateIcon type={STATUS_SHAPE[status]} color={MODULE_STATUS_LABELS[status].color} className={className} />
    </span>
  );
}
