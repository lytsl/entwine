import { useWorkspace } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { toast } from "@entwine/ui/components/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { UserPlusIcon, UsersIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useStore } from "../../../hooks/use-store";
import { rolesFor } from "../../../lib/member";
import { authClient, errorMessage } from "../../../services/auth-client";
import { configQuery, fullWorkspaceQuery } from "../../../services/queries";
import { InviteDialog } from "./-components/invite-dialog";
import { MembersTable } from "./-components/members-table";
import { PendingInvitations } from "./-components/pending-invitations";

export const Route = createFileRoute("/$workspaceSlug/settings/members")({ component: MembersPage });

function MembersPage() {
  const { workspaceId, userId } = useWorkspace();
  const store = useStore();
  const queryClient = useQueryClient();
  const query = fullWorkspaceQuery(workspaceId);
  const workspace = useQuery(query).data;
  const mail = useQuery(configQuery).data?.mail;
  const canManage = store.members.isAdmin();
  const owner = store.members.get(userId)?.role === "owner";
  const manages = (member: { role: string }) => canManage && (owner || member.role !== "owner");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const pending = workspace?.invitations.filter((i) => i.status === "pending") ?? [];

  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: query.queryKey }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Better Auth's list is not on the stream: a change of the synced directory says when to ask again.
  const directory = store.members.active;
  const asked = useRef(directory);
  useEffect(() => {
    if (asked.current === directory) return;
    asked.current = directory;
    void queryClient.invalidateQueries({ queryKey: fullWorkspaceQuery(workspaceId).queryKey });
  }, [directory, queryClient, workspaceId]);

  return (
    <>
      <PageHeader title="Members" icon={<UsersIcon />} count={workspace?.members.length}>
        {canManage && (
          <Button size="sm" className="h-7 text-body" onClick={() => setInviting(true)}>
            <UserPlusIcon />
            Invite people
          </Button>
        )}
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 @min-[40rem]/main:px-6">
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 border-b pb-3">
              <h2 className="text-base font-semibold">Members</h2>
              <p className="text-body text-muted-foreground">
                Everyone here sees every project. Owners and admins manage members and can delete projects.
              </p>
            </div>
            <MembersTable
              members={workspace?.members ?? []}
              userId={userId}
              roles={rolesFor(owner)}
              manages={manages}
              onRole={(member, role) =>
                action.mutate(() =>
                  authClient.organization.updateMemberRole({ memberId: member.id, role, organizationId: workspaceId }),
                )
              }
              onRemove={(member) => setRemoving({ id: member.id, name: member.user.name })}
            />
          </section>

          {canManage && pending.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 border-b pb-3">
                <h2 className="text-base font-semibold">Pending invitations</h2>
                <p className="text-body text-muted-foreground">
                  {mail
                    ? "Each was mailed its link. Copy one to share it another way."
                    : "This server sends no mail: copy an invitation's link to share it."}
                </p>
              </div>
              <PendingInvitations
                invitations={pending}
                onCancel={(invitationId) =>
                  action.mutate(() => authClient.organization.cancelInvitation({ invitationId }))
                }
              />
            </section>
          )}
        </div>
      </div>
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          description="They lose access to this workspace at once. Their issues and comments stay, under their name."
          confirmLabel="Remove member"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            action.mutate(() =>
              authClient.organization.removeMember({ memberIdOrEmail: removing.id, organizationId: workspaceId }),
            );
            setRemoving(null);
          }}
        />
      )}
      {inviting && (
        <InviteDialog
          roles={rolesFor(owner)}
          onClose={() => setInviting(false)}
          onInvite={(email, role) =>
            action.mutate(() => authClient.organization.inviteMember({ email, role, organizationId: workspaceId }), {
              onSuccess: () => {
                toast.success(
                  mail ? `Invitation sent to ${email}` : `Invitation made for ${email}: copy its link below`,
                );
                setInviting(false);
              },
            })
          }
        />
      )}
    </>
  );
}
