import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createAuthApp } from "@/auth/auth.factory";
import { auth } from "@/auth/better-auth";

const app = createAuthApp()
	.post(
		"/check-slug",
		zValidator(
			"json",
			z
				.object({
					slug: z.string().min(3),
				})
				.superRefine((data, ctx) => {
					if (["login", "signup"].includes(data.slug)) {
						ctx.addIssue({
							code: "custom",
							message: "This workspace URL is already taken",
							path: ["slug"],
							params: {
								actual: data.slug,
								expected: "valid URL",
							},
						});
					}
				}),
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
	});

export default app;
