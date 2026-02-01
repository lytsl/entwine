import { env } from "@entwine/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import todoRouter from "@/api/routers/todo";
import { type AuthHonoVariablesType, auth } from "@/auth";

const app = new Hono<{
	Variables: AuthHonoVariablesType;
}>()
	.use(logger())
	.use(
		"/*",
		cors({
			origin: env.CORS_ORIGIN,
			allowMethods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
			allowHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)
	.use("*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session) {
			c.set("user", null);
			c.set("session", null);
			await next();
			return;
		}
		c.set("user", session.user);
		c.set("session", session.session);
		await next();
	})
	.get("/health", (c) => {
		return c.json("OK");
	})
	.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
	.use("*", async (c, next) => {
		// const session = c.get("session")
		const user = c.get("user");
		if (!user) return c.body(null, 401);
		await next();
	})
	.route("/todo", todoRouter)
	.get("/privateData", (c) => c.json(c.get("user")));

// export const apiHandler = new OpenAPIHandler(appRouter, {
// 	plugins: [
// 		new OpenAPIReferencePlugin({
// 			schemaConverters: [new ZodToJsonSchemaConverter()],
// 		}),
// 	],
// 	interceptors: [
// 		onError((error) => {
// 			console.error(error);
// 		}),
// 	],
// });

export type AppType = typeof app;

export default {
	port: 3000,
	fetch: app.fetch,
};
