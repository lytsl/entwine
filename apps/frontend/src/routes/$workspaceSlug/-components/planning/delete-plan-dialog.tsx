import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { toast } from "@entwine/ui/components/ui/toast";
import { useStore } from "../../../../hooks/use-store";
import { type Cycle, type Module, type PlanKind } from "../../../../types/rows";

export function DeletePlanDialog({
  kind,
  plan,
  issueCount,
  onClose,
  onDeleted,
}: {
  kind: PlanKind;
  plan: Cycle | Module;
  issueCount: number;
  onClose(): void;
  onDeleted?(): void;
}) {
  const store = useStore();
  const issues = `${issueCount} ${issueCount === 1 ? "issue" : "issues"}`;
  return (
    <ConfirmDialog
      title={`Delete ${kind} ${plan.name}?`}
      description={
        issueCount === 0
          ? `The ${kind} has no issues. It is deleted for every member.`
          : kind === "cycle"
            ? `Its ${issues} stay in the project, in no cycle. The cycle is deleted for every member.`
            : `Its ${issues} stay in the project and in their other modules. The module is deleted for every member.`
      }
      confirmLabel={`Delete ${kind}`}
      onClose={onClose}
      onConfirm={() => {
        void (kind === "cycle" ? store.cycles.delete(plan.id) : store.modules.delete(plan.id));
        toast.success(`${kind === "cycle" ? "Cycle" : "Module"} ${plan.name} deleted`);
        onClose();
        onDeleted?.();
      }}
    />
  );
}
