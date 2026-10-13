import { useWorkspace } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { PropertySelect } from "@entwine/ui/components/ui/property-select";
import { toast } from "@entwine/ui/components/ui/toast";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { authClient, errorMessage, type WorkspaceInfo } from "../../../../services/auth-client";
import { fullWorkspaceQuery } from "../../../../services/queries";

/**
 * Better Auth has no transfer of its own: the new owner is made one first, then the old one an admin, so that the
 * workspace always keeps an owner. Should the second step fail, it has two, which another try puts right.
 */
export function TransferOwnership({ workspace }: { workspace: WorkspaceInfo }) {
  const { userId } = useWorkspace();
  const queryClient = useQueryClient();
  const query = fullWorkspaceQuery(workspace.id);
  const members = useQuery(query).data?.members ?? [];
  const me = members.find((member) => member.userId === userId);
  const candidates = members.filter((member) => member.userId !== userId);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const chosen = candidates.find((member) => member.id === chosenId);
  const transfer = useMutation({
    mutationFn: async () => {
      const organizationId = workspace.id;
      await authClient.organization.updateMemberRole({ memberId: chosen!.id, role: "owner", organizationId });
      await authClient.organization.updateMemberRole({ memberId: me!.id, role: "admin", organizationId });
    },
    onSuccess: () => {
      toast.success(`${chosen?.user.name} is the owner of ${workspace.name}`);
      void queryClient.invalidateQueries({ queryKey: query.queryKey });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border px-5 py-4">
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <span className="text-body font-medium">Transfer ownership</span>
        <span className="text-body text-muted-foreground">
          {candidates.length
            ? "The new owner takes over. You stay on as an admin."
            : "Invite another member before you can hand the workspace on."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <PropertySelect<string>
          label="New owner"
          face="pill"
          className="h-8"
          align="end"
          width={240}
          searchPlaceholder="Member…"
          disabled={!candidates.length}
          options={candidates.map((member) => ({
            value: member.id,
            label: member.user.name,
            icon: (
              <UserAvatar user={{ id: member.userId, name: member.user.name, image: member.user.image }} size={18} />
            ),
          }))}
          isSelected={(id) => id === chosenId}
          onSelect={setChosenId}
        >
          {chosen?.user.name ?? "Choose a member"}
        </PropertySelect>
        <Button variant="outline" disabled={!chosen || !me || transfer.isPending} onClick={() => setConfirming(true)}>
          Transfer
        </Button>
      </div>
      {confirming && chosen && (
        <ConfirmDialog
          title="Transfer ownership?"
          description={`${chosen.user.name} becomes the owner of ${workspace.name}. You stay on as an admin, without what only owners may do: delete the workspace, or transfer it again.`}
          confirmLabel="Transfer ownership"
          destructive={false}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            transfer.mutate();
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}
