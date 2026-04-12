import {
  getRandomSafeColor,
  getRandomSafeEmoji,
} from "@entwine/utility/random";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, multiSession, organization } from "better-auth/plugins";
import { and, eq, like } from "drizzle-orm";
import { dbManager } from "@/db/db-manager";
import mainSchema from "@/db/schema-main";
import schema from "@/db/schema-main/auth";
import { env } from "../../env";

const db = dbManager.db;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: schema,
    transaction: true,
  }),
  trustedOrigins: [env.CORS_ORIGIN],
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [
    organization({
      teams: { enabled: false },
      organizationHooks: {
        beforeCreateOrganization: async ({ organization }) => {
          if (
            !organization.slug ||
            ["login", "signup"].includes(organization.slug)
          ) {
            throw new Error("Invalid slug");
          }
          return { data: organization };
        },
      },
      schema: {
        organization: {
          additionalFields: {
            metadata: {
              type: "json",
              required: true,
              input: false,
              defaultValue: () => ({ color: getRandomSafeColor() }),
              // transform: {
              // 	output: (value)=>JSON.parse(value as string),
              // }
            },
          },
        },
      },
    }),
    admin({}),
    multiSession(),
  ],
});

export type BetterAuthSession = typeof auth.$Infer.Session & {
  organization: typeof mainSchema.organization.$inferSelect;
};
