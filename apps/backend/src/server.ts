import { dirname, join } from "node:path";
import { syncSchema } from "@entwine/shared";
import { createTenants } from "@entwine/sync-engine";
import { createApp } from "./app";
import { createAuth } from "./auth/create-auth";
import { recipientQueries } from "./auth/recipients";
import { prepareTenant } from "./database/prepare";
import { DEV_SECRET, readEnv } from "./env";
import { avatarStore } from "./services/avatars";
import { lockData } from "./services/data-lock";
import { notificationDelivery } from "./services/delivery/delivery";
import { consoleMailer, type Mailer, smtpMailer } from "./services/mail/mailer";
import { forgetMember, syncMember } from "./services/member-directory";
import { type Pusher, webPusher } from "./services/push";
import { keptSecret } from "./services/secret";
import { deleteWorkspaceData, finishWorkspaceDeletions, markWorkspaceDeleting } from "./services/workspace-data";
import { syncWorkspace } from "./services/workspace-name";

/** Each replaces what the environment says. */
export interface ServerOptions {
  authPath?: string;
  tenantDir?: string;
  pagesDir?: string;
  secret?: string;
  baseURL?: string;
  /** Mail goes through it, and is offered as reaching people. */
  mailer?: Mailer;
  /** Pushes go through it; tests record them. */
  push?: { publicKey: string; push: Pusher };
  /** How long notification mail waits for an undo; tests shorten it. */
  mailDelayMs?: number;
  workspaceCreation?: boolean;
  /** The sync stream's heartbeat; tests shorten it. */
  heartbeatMs?: number;
  /** How long a workspace's change log keeps a change; tests shorten it. */
  retentionMs?: number;
  /** Loads and writes a member may send per minute; seeds and tests that send more raise it. */
  requestsPerMinute?: number;
  /** The clock the cycle schedules are planned by; tests move it. */
  now?: () => number;
}

/** `entwine <noreply@example.com>` gives `noreply@example.com`. */
const addressOf = (from: string) => /<([^>]+)>/.exec(from)?.[1] ?? from;

export async function createServer(options: ServerOptions = {}) {
  const env = readEnv();
  const tenantDir = options.tenantDir ?? env.tenantDir;
  const authPath = options.authPath ?? env.authPath;
  /** The auth database's directory, which also keeps avatars, the push keys and a secret the server made. */
  const dataDir = dirname(authPath);
  const given = options.secret ?? env.secret;
  if (given === DEV_SECRET && env.production) throw new Error("Set BETTER_AUTH_SECRET");
  const unlock = lockData(dataDir);
  const secret = given ?? (env.production ? await keptSecret(join(dataDir, "secret")) : DEV_SECRET);
  const tenants = createTenants({
    dir: tenantDir,
    schema: syncSchema,
    prepare: prepareTenant,
    retentionMs: options.retentionMs,
  });
  const baseURL = options.baseURL ?? env.baseURL;
  const from = env.mailFrom ?? `entwine <noreply@${new URL(baseURL).hostname}>`;
  const smtp = env.smtpURL ? smtpMailer(env.smtpURL, from) : undefined;
  // In development the log is the mailbox. In production without SMTP, invitation links still go to the log, but
  // nothing that needs a reader's mailbox (reset, verification, notifications) is offered.
  const mail = Boolean(options.mailer ?? smtp) || !env.production;
  const mailer = options.mailer ?? smtp ?? consoleMailer;
  const avatars = avatarStore(join(dataDir, "avatars"));
  const auth = await createAuth({
    path: authPath,
    secret,
    baseURL,
    mailer,
    mail,
    workspaceCreation: options.workspaceCreation ?? env.workspaceCreation,
    onMembership: (workspaceId, userId) => syncMember(auth, tenants, workspaceId, userId),
    onWorkspace: (workspaceId) => syncWorkspace(auth, tenants, workspaceId),
    onWorkspaceDeleting: (workspaceId) => markWorkspaceDeleting(tenantDir, workspaceId),
    onWorkspaceDeleted: (workspaceId) => deleteWorkspaceData(tenants, tenantDir, workspaceId),
    onAccountDeleted: async (user, left) => {
      for (const workspaceId of left) await forgetMember(tenants, workspaceId, user.id);
      await avatars.remove(user.image);
    },
  });
  await finishWorkspaceDeletions(tenants, tenantDir, auth.workspaceExists);
  // A push service reaches the operator by an https address, or else by mail.
  const push =
    options.push ??
    (await webPusher(
      join(dataDir, "push-keys.json"),
      baseURL.startsWith("https:") ? new URL(baseURL).origin : `mailto:${addressOf(from)}`,
    ));
  const delivery = notificationDelivery({
    tenants,
    tenantDir,
    baseURL,
    recipients: recipientQueries(auth.database),
    workspace: auth.workspace,
    mailer: mail ? mailer : undefined,
    push: push.push,
    delayMs: options.mailDelayMs,
  });
  await delivery.resume();
  const app = createApp(auth, tenants, {
    origin: new URL(baseURL).origin,
    fileDir: tenantDir,
    pagesDir: options.pagesDir ?? env.pagesDir,
    clientIpHeader: env.clientIpHeader,
    heartbeatMs: options.heartbeatMs,
    now: options.now,
    requestsPerMinute: options.requestsPerMinute ?? env.requestsPerMinute,
    delivery,
    avatars,
    config: { mail, pushKey: push.publicKey },
  });
  return {
    app,
    auth,
    tenants,
    async close() {
      await delivery.close();
      await tenants.close();
      auth.close();
      unlock();
    },
  };
}
