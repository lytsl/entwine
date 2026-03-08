import { createMiddleware } from "hono/factory";

export const authGuard = createMiddleware(async (c, next) => {
	const user = c.get("user");
	if (!user) {
		return c.body(null, 401);
	}
	await next();
});
