import { Button, buttonVariants } from "@entwine/ui/components/ui/button";
import { CardContent, CardFooter } from "@entwine/ui/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AuthCard } from "../../components/auth-card";
import { authClient, errorMessage } from "../../services/auth-client";
import { sessionQuery, workspacesQuery } from "../../services/queries";

export const Route = createFileRoute("/invite/$invitationId")({
  // Signed out, the invited address decides: one without an account signs up. An invitation the server does not know
  // of goes to sign-in, after which the page says so.
  beforeLoad: async ({ context, location, params }) => {
    if (await context.queryClient.query(sessionQuery)) return;
    const invitee: { email: string; account: boolean } | null = await fetch(`/api/invitations/${params.invitationId}`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    throw redirect({
      to: invitee && !invitee.account ? "/signup" : "/login",
      search: { next: location.href, email: invitee?.email },
    });
  },
  component: InvitationPage,
});

function InvitationPage() {
  const { invitationId } = Route.useParams();
  const { queryClient } = Route.useRouteContext();
  const navigate = Route.useNavigate();
  const invitation = useQuery({
    queryKey: ["invitation", invitationId],
    queryFn: () => authClient.organization.getInvitation({ query: { id: invitationId } }),
    retry: false,
  });
  const accept = useMutation({
    mutationFn: () => authClient.organization.acceptInvitation({ invitationId }),
    onSuccess: async () => {
      const workspaces = await queryClient.query({ ...workspacesQuery, staleTime: 0 });
      const joined = workspaces.find((w) => w.id === invitation.data?.organizationId);
      await navigate(joined ? { to: "/$workspaceSlug", params: { workspaceSlug: joined.slug } } : { to: "/" });
    },
  });

  if (invitation.isPending)
    return (
      <AuthCard title="Invitation" description="Loading…">
        {null}
      </AuthCard>
    );
  if (!invitation.data) {
    return (
      <AuthCard title="Invitation not found" description={errorMessage(invitation.error)}>
        <CardFooter>
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Go to your workspaces
          </Link>
        </CardFooter>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={`Join ${invitation.data.organizationName}`}
      description={`${invitation.data.inviterEmail} invited you as ${invitation.data.role}.`}
    >
      <CardContent>
        {accept.error && <p className="text-sm text-destructive">{errorMessage(accept.error)}</p>}
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={() => accept.mutate()} disabled={accept.isPending}>
          Accept invitation
        </Button>
      </CardFooter>
    </AuthCard>
  );
}
