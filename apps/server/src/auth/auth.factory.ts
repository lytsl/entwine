import { Hono } from "hono";
import type { BunWebSocketData } from "hono/bun";
import { createMiddleware } from "hono/factory";
import type { auth } from "./better-auth";

export const authGuard = createMiddleware(async (c, next) => {
	const user = c.get("user");
	if (!user) {
		return c.body(null, 401);
	}
	// c.req.valid("header");
	await next();
});

export function createAuthApp() {
	return new Hono<{
		Variables: typeof auth.$Infer.Session;
		Bindings: {
			server: Bun.Server<BunWebSocketData>;
		};
	}>().use("*", async (c, next) => {
		const user = c.get("user");
		if (!user) {
			console.log("session", c.get("session"));
			return c.body(null, 401);
		}

		await next();
	});
}
