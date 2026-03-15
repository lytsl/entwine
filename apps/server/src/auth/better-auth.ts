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
			teams: { enabled: true },
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
				beforeAddMember: async ({ member, user, organization }) => {
					const emailUsername = user.email.split("@")[0]!.toLowerCase();
					const similiarUsernameData = await db
						.select({ username: mainSchema.member.username })
						.from(mainSchema.member)
						.where(
							and(
								eq(mainSchema.member.organizationId, organization.id),
								like(mainSchema.member.username, `${emailUsername}%`),
							),
						);
					const similiarUsernameSet = new Set(
						similiarUsernameData.map((d) => d.username),
					);

					let counter = 1;
					let username = emailUsername;
					while (similiarUsernameSet.has(username)) {
						username = `${emailUsername}${++counter}`;
					}

					return {
						data: {
							...member,
							username,
						},
					};
				},
				beforeCreateTeam: async ({ team }) => {
					const namePrefix = team.name.substring(0, 3).toUpperCase();
					const similiarSlugData = await db
						.select({ slug: mainSchema.team.slug })
						.from(mainSchema.team)
						.where(
							and(
								eq(mainSchema.team.organizationId, team.organizationId),
								like(mainSchema.team.slug, `${namePrefix}%`),
							),
						);
					const similiarSlugSet = new Set(similiarSlugData.map((d) => d.slug));

					let counter = 1;
					let slug = namePrefix;
					while (similiarSlugSet.has(slug)) {
						slug = `${namePrefix}${++counter}`;
					}

					return {
						data: {
							...team,
							slug,
						},
					};
				},
			},
			schema: {
				member: {
					additionalFields: {
						username: {
							type: "string",
							required: false,
							input: true,
						},
					},
				},
				team: {
					additionalFields: {
						slug: {
							type: "string",
							required: true,
							input: false,
						},
						metadata: {
							type: "json",
							required: true,
							input: false,
							defaultValue: () => ({
								emoji: getRandomSafeEmoji(),
								color: getRandomSafeColor(),
							}),
							// transform: {
							//   output: (value) => JSON.parse(value as string),
							// },
						},
					},
				},
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
