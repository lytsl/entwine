import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import type { THonoBaseEnv } from "./types";

// const orgWsClientMap = new Map<string, Set<WSContext<any>>>();

const app = new Hono<THonoBaseEnv>().get(
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
