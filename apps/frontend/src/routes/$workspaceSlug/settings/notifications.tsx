import { NOTIFICATION_CHOICES, type NotificationChoice } from "@entwine/shared";
import { SwitchField } from "@entwine/ui/components/ui/switch-field";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRingIcon } from "lucide-react";
import { PageHeader } from "../../../components/page-header";
import { NOTIFICATION_CHOICE_TEXT } from "../../../constants/notification";
import { useNotificationPreferences } from "../../../hooks/use-notification-preferences";
import { configQuery, sessionQuery } from "../../../services/queries";
import { SettingsPage } from "../-components/settings/settings-page";
import { SettingsSection } from "../-components/settings/settings-section";
import { PushSwitch } from "./-components/push-switch";

export const Route = createFileRoute("/$workspaceSlug/settings/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const config = useQuery(configQuery).data;
  const user = useQuery(sessionQuery).data?.user;
  const { preferences, set } = useNotificationPreferences();
  const muted = new Set(preferences.mutedNotifications);
  const mailable = Boolean(config?.mail && user?.emailVerified);
  const choose = (choice: NotificationChoice, on: boolean) =>
    set({
      mutedNotifications: on
        ? preferences.mutedNotifications.filter((c) => c !== choice)
        : [...preferences.mutedNotifications, choice],
    });
  return (
    <>
      <PageHeader title="Notifications" icon={<BellRingIcon />} />
      <SettingsPage>
        <SettingsSection
          title="Channels"
          description="Your inbox always lists every notification. Turn a channel on to be reached elsewhere too."
        >
          <div className="flex flex-col gap-5 rounded-xl border bg-card/40 p-5">
            <SwitchField
              label="Email"
              description={
                !config?.mail
                  ? "This server sends no mail."
                  : !user?.emailVerified
                    ? `Verify ${user?.email ?? "your address"} first: the banner at the top sends the link again.`
                    : `What you have not read within a few minutes is mailed to ${user.email}, one mail per issue.`
              }
              checked={mailable && preferences.emailNotifications}
              disabled={!mailable}
              onChange={(on) => set({ emailNotifications: on })}
            />
            <PushSwitch serverKey={config?.pushKey} />
          </div>
        </SettingsSection>
        <SettingsSection
          title="Notify me about"
          description="What is mailed and pushed. Your own changes never notify you."
        >
          <div className="flex flex-col gap-5 rounded-xl border bg-card/40 p-5">
            {NOTIFICATION_CHOICES.map((choice) => (
              <div key={choice} className={choice === "completed" ? "border-l-2 pl-4" : undefined}>
                <SwitchField
                  label={NOTIFICATION_CHOICE_TEXT[choice].label}
                  description={NOTIFICATION_CHOICE_TEXT[choice].description}
                  checked={!muted.has(choice)}
                  disabled={false}
                  onChange={(on) => choose(choice, on)}
                />
              </div>
            ))}
          </div>
        </SettingsSection>
      </SettingsPage>
    </>
  );
}
