import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { upgradeWebSocket, websocket } from "hono/bun";
import type { WSContext } from "hono/ws";

export const orgWsClientMap = new Map<string, Set<WSContext<any>>>();

const app = new Hono().get(
	"/",
	upgradeWebSocket((_c) => {
		return {
			onMessage(event, ws) {
				console.log(`Message from client: ${event.data}`);
				// ws.send(JSON.stringify({ message: "Hello" }));
			},
			onClose: (evt, ws) => {
				console.debug("Connection closed", evt, ws);
				const clientSet = orgWsClientMap.get("org") || new Set<typeof ws>();
				clientSet.delete(ws);
				if (clientSet.size) orgWsClientMap.set("org", clientSet);
				else orgWsClientMap.delete("org");
			},
			onOpen: (evt, ws) => {
				console.debug("Connection opened", evt, ws);
				const clientSet = orgWsClientMap.get("org") || new Set<typeof ws>();
				clientSet.add(ws);
				orgWsClientMap.set("org", clientSet);
			},
			onError: (evt, ws) => {
				console.error(evt, ws);
			},
		};
	}),
);

export default app;
