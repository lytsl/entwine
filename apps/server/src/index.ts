import type { Nullable } from "@entwine/utility/types";
import type { Server } from "bun";
import { type ExecutionContext, Hono } from "hono";
import { type BunWebSocketData, websocket } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
	type AuthType,
	auth,
	type BetterAuthSession,
} from "@/auth/better-auth";
import origanizationRouter from "@/routes/auth/organization";
import syncRouter from "@/routes/sync";
import wsRouter from "@/routes/ws";
import { env } from "../env";

const app = new Hono<{
	Variables: Nullable<BetterAuthSession>;
	Bindings: { server: Server<BunWebSocketData> };
}>()
	.use(logger())
	.use(
		"/*",
		cors({
			origin: env.CORS_ORIGIN,
			allowMethods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
			allowHeaders: ["Content-Type", "Authorization", "x-organization-slug"],
			credentials: true,
		}),
	)
	.use("*", async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });

		c.set("user", session?.user || null);
		c.set("session", session?.session || null);
		c.set("organization", session?.organization || null);

		await next();
	})
	.get("/health", (c) => {
		return c.json("OK");
	})
	.route("/ws", wsRouter)
	.route("/sync", syncRouter)
	.route("/auth/organization", origanizationRouter)
	.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

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

const server: Server<BunWebSocketData> = Bun.serve({
	port: env.PORT,
	fetch: (request: Request, Env?: unknown, executionCtx?: ExecutionContext) => {
		return app.fetch(request, { ...(Env || {}), server }, executionCtx);
	},
	websocket,
});

export type { AuthType };
