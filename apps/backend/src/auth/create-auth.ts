/**
 * Better Auth on its own SQLite database. `onMembership` is called whenever what a workspace should know about
 * one of its members may have changed, so the tenant's member directory can follow; `onWorkspace` and
 * `onWorkspaceDeleting` and `onWorkspaceDeleted` say the same of the workspace itself.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ACCOUNT_FIELDS, notificationPreferences, PASSWORD_MIN_LENGTH } from "@entwine/shared";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { organization } from "better-auth/plugins/organization";
import { CLIENT_IP_HEADER } from "../middleware/client-ip";
import { consoleMailer, type Mail, type Mailer } from "../services/mail/mailer";
import { changeEmailMail } from "../services/mail/templates/change-email";
import { invitationMail } from "../services/mail/templates/invitation";
import { resetPasswordMail } from "../services/mail/templates/reset-password";
import { verifyEmailMail } from "../services/mail/templates/verify-email";
import { accountDeletion, type WorkspaceApi } from "./account-deletion";
import { authHooks, type HookOptions } from "./hooks";
import { membershipQueries } from "./memberships";
import { pushSubscriptions } from "./push-subscriptions";

export interface AuthOptions
  extends Pick<
    HookOptions,
    "workspaceCreation" | "onMembership" | "onWorkspace" | "onWorkspaceDeleting" | "onWorkspaceDeleted"
  > {
  path: string;
  secret: string;
  baseURL: string;
  mailer?: Mailer;
  /** Whether mail reaches people. Without it, password reset and verification are refused rather than lost. */
  mail?: boolean;
  /** An account is gone; `left` are the workspaces it left, which keep its name on its work. */
  onAccountDeleted?(user: { id: string; image?: string | null }, left: string[]): Promise<void>;
}

const { emailNotifications, mutedNotifications } = notificationPreferences.shape;

export async function createAuth(options: AuthOptions) {
  if (options.path !== ":memory:") mkdirSync(dirname(options.path), { recursive: true });
  const database = new Database(options.path);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  const mailer = options.mailer ?? consoleMailer;
  // Never awaited: the asker should not wait for the mail server, nor learn from its answer's timing whether an
  // address has an account.
  const send = (mail: Promise<Mail>) =>
    void mail.then(mailer, (error) => console.error("[mail] a mail could not be written", error));
  const { baseURL } = options;
  const { membership, workspacesOf, workspaceExists, workspace, accountWorkspaces, invitee } =
    membershipQueries(database);
  const { databaseHooks, hooks, organizationHooks } = authHooks({
    workspaceCreation: options.workspaceCreation,
    onMembership: options.onMembership,
    onWorkspace: options.onWorkspace,
    onWorkspaceDeleting: options.onWorkspaceDeleting,
    onWorkspaceDeleted: options.onWorkspaceDeleted,
    membership,
    workspacesOf,
  });
  let workspaceApi: WorkspaceApi | undefined;
  const deletion = accountDeletion({
    accountWorkspaces,
    api: () => workspaceApi!,
    onDeleted: options.onAccountDeleted,
  });

  const authOptions = {
    appName: "entwine",
    database,
    secret: options.secret,
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
    advanced: { database: { generateId: "uuid" }, ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] } },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      // Whoever resets a password may be locking out someone who took the old one.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: options.mail
        ? async ({ user, url }, request) => send(resetPasswordMail(baseURL, user, url, request))
        : undefined,
    },
    emailVerification: options.mail
      ? {
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: async ({ user, url }) => send(verifyEmailMail(baseURL, user, url)),
        }
      : undefined,
    user: {
      additionalFields: {
        emailNotifications: { ...ACCOUNT_FIELDS.emailNotifications, validator: { input: emailNotifications } },
        mutedNotifications: { ...ACCOUNT_FIELDS.mutedNotifications, validator: { input: mutedNotifications } },
      },
      changeEmail: {
        enabled: true,
        // An address nobody verified proves nothing to keep: it changes at once, and the new one is sent a link.
        updateEmailWithoutVerification: true,
        sendChangeEmailConfirmation: options.mail
          ? async ({ user, newEmail, url }, request) => send(changeEmailMail(baseURL, user, newEmail, url, request))
          : undefined,
      },
      // Without a password, Better Auth asks for a session opened within the last day.
      deleteUser: { enabled: true, beforeDelete: deletion.beforeDelete, afterDelete: deletion.afterDelete },
    },
    databaseHooks,
    hooks,
    plugins: [
      organization({
        // The invitation's link is its secret: someone signed in with the invited address need not verify it too.
        requireEmailVerificationOnInvitation: false,
        sendInvitationEmail: async (invitation) => send(invitationMail(baseURL, invitation)),
        organizationHooks,
      }),
      pushSubscriptions(),
    ],
  } satisfies BetterAuthOptions;

  await (await getMigrations(authOptions)).runMigrations();
  const auth = betterAuth(authOptions);
  workspaceApi = auth.api;

  return {
    auth,
    database,
    membership,
    workspaceExists,
    workspace,
    invitee,
    close: () => database.close(),
  };
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;
