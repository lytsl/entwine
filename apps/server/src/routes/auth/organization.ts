import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { and, eq } from "drizzle-orm";
import { createPrivateApp } from "@/auth/auth.factory";
import { auth } from "@/auth/better-auth";
import { dbManager } from "@/db/db-manager";
import mainSchema from "@/db/schema-main";

const app = createPrivateApp()
	.post(
		"/check-slug",
		arktypeValidator(
			"json",
			type({
				slug: "string >= 3",
			}).narrow(
				(data, ctx) =>
					!["login", "signup"].includes(data.slug) ||
					ctx.reject({
						message: "This workspace URL is already taken",
						actual: data.slug,
						path: ["slug"],
						expected: "valid URL",
					}),
			),
		),
		async (c) => {
			const data = await auth.api.checkOrganizationSlug({
				body: c.req.valid("json"),
			});
			console.log(data);
			return c.json(data, 201);
		},
	)
	.get(
		"/get-session",
		arktypeValidator(
			"query",
			type({
				slug: "string >= 3",
			}),
		),
		async (c) => {
			const query = c.req.valid("query");
			const user = c.get("user");
			const session = c.get("session");

			const data = await dbManager.db
				.select()
				.from(mainSchema.member)
				.innerJoin(
					mainSchema.organization,
					eq(mainSchema.member.organizationId, mainSchema.organization.id),
				)
				.where(
					and(
						eq(mainSchema.member.userId, user.id),
						eq(mainSchema.organization.slug, query.slug),
					),
				);
			if (data.length === 0) {
				return c.body(null, 403);
			}
			const response = { session, user, ...data[0]! };
			return c.json(response, 200);
		},
	);

export default app;
