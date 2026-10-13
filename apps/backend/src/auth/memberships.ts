/** Read straight from Better Auth's tables. */
import type { Database } from "bun:sqlite";
import type { Role } from "@entwine/shared";

export interface Membership {
  userId: string;
  role: Role;
  name: string;
  email: string;
  image: string | null;
}

export interface AccountWorkspace {
  workspaceId: string;
  name: string;
  role: Role;
  members: number;
  owners: number;
}

export function membershipQueries(database: Database) {
  const workspacesOf = (userId: string): { workspaceId: string }[] =>
    database
      .query<{ workspaceId: string }, [string]>('SELECT "organizationId" AS workspaceId FROM member WHERE "userId" = ?')
      .all(userId);

  const membership = (workspaceId: string, userId: string): Membership | null =>
    database
      .query<Membership, [string, string]>(
        `SELECT m."userId" AS userId, m.role, u.name, u.email, u.image
         FROM member m JOIN user u ON u.id = m."userId"
         WHERE m."organizationId" = ? AND m."userId" = ?`,
      )
      .get(workspaceId, userId);

  const workspaceExists = (workspaceId: string): boolean =>
    database.query("SELECT 1 FROM organization WHERE id = ?").get(workspaceId) !== null;

  const workspace = (workspaceId: string): { name: string; slug: string } | null =>
    database
      .query<{ name: string; slug: string }, [string]>("SELECT name, slug FROM organization WHERE id = ?")
      .get(workspaceId);

  /** What deleting an account would do to each of its workspaces turns on these. */
  const accountWorkspaces = (userId: string): AccountWorkspace[] =>
    database
      .query<AccountWorkspace, [string]>(
        `SELECT m."organizationId" AS workspaceId, o.name, m.role,
           (SELECT COUNT(*) FROM member WHERE "organizationId" = m."organizationId") AS members,
           (SELECT COUNT(*) FROM member WHERE "organizationId" = m."organizationId" AND role = 'owner') AS owners
         FROM member m JOIN organization o ON o.id = m."organizationId"
         WHERE m."userId" = ?`,
      )
      .all(userId);

  /** A pending invitation's address, and whether it has an account; null for any other id. */
  const invitee = (invitationId: string): { email: string; account: boolean } | null => {
    const row = database
      .query<{ email: string; account: number }, [string, string]>(
        `SELECT i.email, EXISTS (SELECT 1 FROM user WHERE email = i.email) AS account
         FROM invitation i WHERE i.id = ? AND i.status = 'pending' AND i."expiresAt" > ?`,
      )
      .get(invitationId, new Date().toISOString());
    return row && { email: row.email, account: row.account === 1 };
  };

  return { workspacesOf, membership, workspaceExists, workspace, accountWorkspaces, invitee };
}
