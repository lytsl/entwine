import { arktypeValidator } from "@hono/arktype-validator";
import { type } from "arktype";
import { createAuthApp } from "@/auth/auth.factory";
import { auth } from "@/auth/better-auth";
import { createOrgApp } from "@/auth/org-auth.factory";

const app = createAuthApp()
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
	.get("/get-session", async (c) => {
		const response = {
			session: c.get("session"),
			user: c.get("user"),
		};
		return c.json(response, 200);
	})
	.get("/get-session-organization-list", async (c) => {
		const response = {
			session: c.get("session"),
			user: c.get("user"),
		};
		return c.json(response, 200);
	});

export default app;
