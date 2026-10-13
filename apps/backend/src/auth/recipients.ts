/** Whom notifications reach outside the app, read straight from Better Auth's tables. */
import type { Database } from "bun:sqlite";
import type { NotificationChoice } from "@entwine/shared";
import type { PushTarget } from "../services/push";

export interface Recipient {
  name: string;
  email: string;
  /** Mail goes to a verified address only: nobody can have it sent to an address that is not theirs. */
  mailable: boolean;
  muted: NotificationChoice[];
}

export function recipientQueries(database: Database) {
  const recipient = (userId: string): Recipient | null => {
    const row = database
      .query<{ name: string; email: string; mailable: number; muted: string | null }, [string]>(
        `SELECT name, email, "emailVerified" AND "emailNotifications" AS mailable, "mutedNotifications" AS muted
         FROM user WHERE id = ?`,
      )
      .get(userId);
    return row && { ...row, mailable: row.mailable === 1, muted: JSON.parse(row.muted ?? "[]") };
  };

  /** The browsers whose session is still signed in: one that signed out or expired is pushed nothing. */
  const pushTargets = (userId: string): PushTarget[] =>
    database
      .query<PushTarget, [string, string]>(
        `SELECT p.endpoint, p.p256dh, p.auth FROM "pushSubscription" p JOIN session s ON s.id = p."sessionId"
         WHERE p."userId" = ? AND s."expiresAt" > ?`,
      )
      .all(userId, new Date().toISOString());

  const forgetPush = (endpoint: string) => {
    database.query('DELETE FROM "pushSubscription" WHERE endpoint = ?').run(endpoint);
  };

  return { recipient, pushTargets, forgetPush };
}

export type Recipients = ReturnType<typeof recipientQueries>;
