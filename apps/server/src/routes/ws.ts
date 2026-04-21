import type { Nullable } from "@entwine/utility/types";
import type { Server, ServerWebSocket } from "bun";
import { Hono } from "hono";
import { type BunWebSocketData, upgradeWebSocket } from "hono/bun";
import type { BetterAuthSession } from "@/auth/better-auth";

// const orgWsClientMap = new Map<string, Set<WSContext<any>>>();

const app = new Hono<{
	Variables: Nullable<BetterAuthSession>;
	Bindings: { server: Server<BunWebSocketData> };
}>().get(
	"/",
	upgradeWebSocket((_c) => {
		return {
			onClose: (_evt, wsCtx) => {
				const ws = wsCtx.raw as ServerWebSocket;
				ws.unsubscribe("org");
			},
			onOpen: (_evt, wsCtx) => {
				const ws = wsCtx.raw as ServerWebSocket;
				ws.subscribe("org");
			},
			onMessage(evt) {
				console.debug("Message from client: ", evt.data);
			},
			onError: (evt) => {
				console.error(evt);
			},
		};
	}),
);

export default app;
