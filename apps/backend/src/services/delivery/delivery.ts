/**
 * Notifications outside the app. Each is pushed at once to its member's browsers. Mail is gathered per workspace for
 * `delayMs` from the first notification, then goes, per member and issue, for what is still unread: an undo in the
 * meantime takes a notification back before it is mailed, and a burst of edits makes one mail.
 *
 * `<workspace id>.mail` beside the tenant file lists the notifications waiting for mail. It outlives a restart, which
 * mails them; it is emptied before they are sent, so a crash in between loses mail rather than sending it twice.
 */
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Row, Rows } from "@entwine/shared";
import type { Tenants } from "@entwine/sync-engine";
import type { Recipients } from "../../auth/recipients";
import type { Mailer } from "../mail/mailer";
import { notificationMail } from "../mail/templates/notification";
import type { Pusher } from "../push";
import { describe } from "./describe";
import { headline } from "./headline";
import { wanted } from "./wanted";

const MAIL_DELAY_MS = 5 * 60 * 1000;
const MARK = /^([A-Za-z0-9_-]{1,64})\.mail$/;
/** The most values a load matches a field against. */
const AT_ONCE = 1000;

const parts = <T>(items: readonly T[]): T[][] =>
  Array.from({ length: Math.ceil(items.length / AT_ONCE) }, (_, n) => items.slice(n * AT_ONCE, (n + 1) * AT_ONCE));

export interface DeliveryOptions {
  tenants: Tenants<Rows>;
  tenantDir: string;
  baseURL: string;
  recipients: Recipients;
  workspace(workspaceId: string): { name: string; slug: string } | null;
  /** Without one, nothing is mailed. */
  mailer?: Mailer;
  /** Without one, nothing is pushed. */
  push?: Pusher;
  /** Tests shorten it. */
  delayMs?: number;
}

export function notificationDelivery(options: DeliveryOptions) {
  const { tenants, tenantDir, recipients, mailer, push } = options;
  const delayMs = options.delayMs ?? MAIL_DELAY_MS;
  const origin = new URL(options.baseURL).origin;
  const markOf = (workspaceId: string) => join(tenantDir, `${workspaceId}.mail`);
  const pendingIn = async (mark: string): Promise<string[]> =>
    (await Bun.file(mark)
      .json()
      .catch(() => null)) ?? [];
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  /** A workspace's mail jobs run one at a time, so that a flush never drops what a notification just added. */
  const chains = new Map<string, Promise<void>>();
  /** Once closing, nothing more is scheduled: the marks wait for the next start. */
  let closing = false;

  const queue = (workspaceId: string, job: () => Promise<void>) => {
    const next = (chains.get(workspaceId) ?? Promise.resolve())
      .then(job)
      .catch((error) => console.error(`[delivery] workspace ${workspaceId}`, error));
    chains.set(workspaceId, next);
    void next.then(() => {
      if (chains.get(workspaceId) === next) chains.delete(workspaceId);
    });
    return next;
  };

  /** Opens a workspace's window, unless one is open: what comes in the meantime goes with it. */
  const schedule = (workspaceId: string, ms: number) => {
    if (closing || timers.has(workspaceId)) return;
    const timer = setTimeout(() => {
      timers.delete(workspaceId);
      void queue(workspaceId, () => flush(workspaceId));
    }, ms);
    // A pending mail does not keep the process alive: the mark brings it back after a restart.
    timer.unref?.();
    timers.set(workspaceId, timer);
  };

  async function flush(workspaceId: string) {
    const mark = markOf(workspaceId);
    const pending = await pendingIn(mark);
    await rm(mark, { force: true });
    const tenant = await tenants.tenant(workspaceId).catch(() => null);
    const workspace = options.workspace(workspaceId);
    if (!pending.length || !tenant || !workspace || !mailer) return;
    // Undone or deleted ones are gone; read ones were seen.
    const { rows } = await tenant.load(parts(pending).map((ids) => ({ model: "Notification", where: { id: ids } })));
    const unread = ((rows.Notification ?? []) as Row<"Notification">[]).filter((n) => n.readAt === null);
    // An issue's notifications stay together, so that a member gets one mail about it.
    for (const ofIssues of parts([...Map.groupBy(unread, (n) => n.issueId).values()])) {
      const due = ofIssues.flat();
      const described = await describe(tenant, due);
      for (const [memberId, notifications] of Map.groupBy(due, (n) => n.memberId)) {
        const recipient = recipients.recipient(memberId);
        if (!recipient?.mailable) continue;
        for (const [issueId, ofIssue] of Map.groupBy(notifications, (n) => n.issueId)) {
          const entry = described.get(issueId);
          if (!entry) continue;
          const updates = ofIssue
            .sort((a, b) => a.createdAt - b.createdAt)
            .flatMap((n) => entry.updates.get(n.id) ?? [])
            .filter(({ update, completed }) => wanted(recipient.muted, update.kind, completed))
            .map(({ update }) => update);
          if (!updates.length) continue;
          const mail = await notificationMail(options.baseURL, {
            to: recipient.email,
            workspace,
            project: entry.project,
            issue: entry.issue,
            updates,
          });
          await mailer(mail);
        }
      }
    }
  }

  async function pushNow(workspaceId: string, rows: Row<"Notification">[]) {
    if (!push) return;
    const targeted = rows
      .map((row) => ({ row, targets: recipients.pushTargets(row.memberId) }))
      .filter(({ targets }) => targets.length);
    const workspace = options.workspace(workspaceId);
    if (!targeted.length || !workspace) return;
    const described = await describe(await tenants.tenant(workspaceId), rows);
    for (const { row, targets } of targeted) {
      const entry = described.get(row.issueId);
      const told = entry?.updates.get(row.id);
      const recipient = recipients.recipient(row.memberId);
      if (!entry || !told || !recipient || !wanted(recipient.muted, row.kind, told.completed)) continue;
      const message = {
        title: headline(told.update, entry.issue.key),
        body: told.update.text ? told.update.text.slice(0, 200) : entry.issue.title,
        url: `${origin}/${workspace.slug}/issues/${row.issueId}`,
        tag: row.issueId,
      };
      for (const target of targets) if (!(await push(target, message))) recipients.forgetPush(target.endpoint);
    }
  }

  return {
    /** The notifications a transaction wrote, once it has committed. */
    notified(workspaceId: string, rows: Row<"Notification">[]) {
      if (!rows.length) return;
      pushNow(workspaceId, rows).catch((error) => console.error(`[delivery] push in ${workspaceId}`, error));
      if (!mailer) return;
      void queue(workspaceId, async () => {
        const mark = markOf(workspaceId);
        await Bun.write(mark, JSON.stringify([...(await pendingIn(mark)), ...rows.map((n) => n.id)]));
        schedule(workspaceId, delayMs);
      });
    },
    /** At start: the workspaces whose mail was waiting when the server stopped, which has waited long enough. */
    async resume() {
      for (const name of await readdir(tenantDir).catch(() => [])) {
        const workspaceId = MARK.exec(name)?.[1];
        if (workspaceId) schedule(workspaceId, 0);
      }
    },
    async close() {
      closing = true;
      await Promise.all(chains.values());
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}

export type Delivery = ReturnType<typeof notificationDelivery>;
