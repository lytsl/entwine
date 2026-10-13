import { useWorkspace } from "@entwine/db-collection/react";
import { Button } from "@entwine/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { UserIcon } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../../components/page-header";
import { useStore } from "../../../hooks/use-store";
import { sessionQuery } from "../../../services/queries";
import { SettingsPage } from "../-components/settings/settings-page";
import { SettingsSection } from "../-components/settings/settings-section";
import { AvatarRow } from "./-components/avatar-row";
import { ChangeEmailDialog } from "./-components/change-email-dialog";
import { DeleteAccountDialog } from "./-components/delete-account-dialog";
import { PasswordForm } from "./-components/password-form";
import { ProfileForm } from "./-components/profile-form";

export const Route = createFileRoute("/$workspaceSlug/settings/profile")({ component: ProfilePage });

function ProfilePage() {
  const { userId } = useWorkspace();
  const me = useStore().members.get(userId);
  const verified = useQuery(sessionQuery).data?.user.emailVerified ?? false;
  const [dialog, setDialog] = useState<"email" | "delete" | null>(null);
  return (
    <>
      <PageHeader title="Profile" icon={<UserIcon />} />
      <SettingsPage>
        <SettingsSection title="Profile" description="How you appear to the members of every workspace you are in.">
          {me && (
            <>
              <div className="rounded-xl border bg-card/40 p-5">
                <AvatarRow member={me} />
              </div>
              <div className="rounded-xl border bg-card/40 p-5">
                <ProfileForm key={me.name} member={me} onChangeEmail={() => setDialog("email")} />
              </div>
            </>
          )}
        </SettingsSection>
        <SettingsSection
          title="Password"
          description="Changing your password signs you out everywhere but in this browser."
        >
          <div className="rounded-xl border bg-card/40 p-5">
            <PasswordForm />
          </div>
        </SettingsSection>
        <SettingsSection title="Danger zone">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-destructive/30 px-5 py-4">
            <div className="flex min-w-48 flex-1 flex-col gap-0.5">
              <span className="text-body font-medium">Delete account</span>
              <span className="text-body text-muted-foreground">
                Workspaces only you belong to are deleted with your account. Elsewhere, your work stays under your name.
              </span>
            </div>
            <Button variant="destructive" onClick={() => setDialog("delete")}>
              Delete account
            </Button>
          </div>
        </SettingsSection>
      </SettingsPage>
      {me && dialog === "email" && (
        <ChangeEmailDialog email={me.email} verified={verified} onClose={() => setDialog(null)} />
      )}
      {me && dialog === "delete" && <DeleteAccountDialog email={me.email} onClose={() => setDialog(null)} />}
    </>
  );
}
