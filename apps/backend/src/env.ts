/** Nothing else reads `process.env`. */
import { join } from "node:path";

const DATA = join(import.meta.dir, "../../../data");

/** The secret of a development instance; production refuses to start with it. */
export const DEV_SECRET = "entwine-development-secret-change-me-please";

/** Read when asked rather than when imported, so a process may set a variable before it builds a server. */
export const readEnv = () => ({
  port: Number(process.env.PORT ?? 3001),
  production: process.env.NODE_ENV === "production",
  /** Without it, development uses `DEV_SECRET` and production makes and keeps its own. */
  secret: process.env.BETTER_AUTH_SECRET,
  /** The app's address: where its pages are served, which the frontend proxies `/api` from. */
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  authPath: process.env.AUTH_DB_PATH ?? join(DATA, "auth.db"),
  tenantDir: process.env.TENANT_DB_DIR ?? join(DATA, "tenants"),
  /** The S3-compatible bucket backups are sent to. Without `bucket`, none are made. */
  backup: {
    bucket: process.env.S3_BUCKET,
    /** Any store but AWS needs it. */
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  /** Where `bun run build` puts the frontend. */
  pagesDir: join(import.meta.dir, "../../frontend/dist"),
  workspaceCreation: process.env.DISABLE_WORKSPACE_CREATION !== "1",
  /** The header in which a reverse proxy gives the client's address, such as `x-forwarded-for`. */
  clientIpHeader: process.env.CLIENT_IP_HEADER,
  requestsPerMinute: Number(process.env.SYNC_REQUESTS_PER_MINUTE) || undefined,
  /** Without it, mail is printed in the log. */
  smtpURL: process.env.SMTP_URL,
  mailFrom: process.env.MAIL_FROM,
});
