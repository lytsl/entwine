import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { BunWebSocketData } from "hono/bun";
import { createMiddleware } from "hono/factory";
import { dbManager } from "@/db/db-manager";
import mainSchema from "@/db/schema-main";
import type { auth } from "./better-auth";

export const authGuard = createMiddleware(async (c, next) => {
	const user = c.get("user");
	if (!user) {
		return c.body(null, 401);
	}
	// c.req.valid("header");
	await next();
});

const orgHeaderSchema = type({
	"x-organization-slug": type("string").default("linear"),
});

export function createOrgApp() {
	return new Hono<{
		Variables: typeof auth.$Infer.Session & {
			organization: typeof mainSchema.organization.$inferSelect;
		};
		Bindings: {
			server: Bun.Server<BunWebSocketData>;
		};
	}>()
		.use("*", arktypeValidator("header", orgHeaderSchema))
		.use("*", async (c, next) => {
			const user = c.get("user");
			if (!user) {
				console.log("session", c.get("session"));
				return c.body(null, 401);
			}

			const headers = c.req.valid("header") as typeof orgHeaderSchema.infer;
			const db = dbManager.db;

			const [dbResult] = await db
				.select()
				.from(mainSchema.organization)
				.innerJoin(
					mainSchema.member,
					eq(mainSchema.member.organizationId, mainSchema.organization.id),
				)
				.where(
					and(
						eq(mainSchema.organization.slug, headers["x-organization-slug"]),
						eq(mainSchema.member.userId, user.id),
					),
				)
				.limit(1);

			if (!dbResult) {
				console.log("slug", headers["x-organization-slug"]);
				return c.body(null, 401);
			}

			c.set("organization", dbResult.organization);

			await next();
		});
}
