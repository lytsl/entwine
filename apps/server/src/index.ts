import type { Server } from "bun";
import { type ExecutionContext, Hono } from "hono";
import { type BunWebSocketData, websocket } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "@/auth/better-auth";
import origanizationRouter from "@/routes/auth/organization";
import issueSyncRouter from "@/routes/sync/issue";
import wsRouter from "@/routes/ws";
import { env } from "../env";
import type { THonoBaseEnv } from "./routes/types";
import path from "node:path";

const app = new Hono<THonoBaseEnv>()
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
	.route("/ws", wsRouter)
	.route("/sync/issue", issueSyncRouter)
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

export type AppType = typeof app;

const server: Server<BunWebSocketData> = Bun.serve({
	port: env.PORT,
	fetch: (request: Request, Env?: unknown, executionCtx?: ExecutionContext) => {
		return app.fetch(request, { ...(Env || {}), server }, executionCtx);
	},
	websocket,
});

// server.pu

// export default server;
