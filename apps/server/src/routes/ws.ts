import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";

const app = new Hono().get(
	"/",
	upgradeWebSocket((_c) => {
		return {
			onMessage(event, ws) {
				console.log(`Message from client: ${event.data}`);
				ws.send(JSON.stringify({ message: "Hello" }));
			},
			onClose: (evt, ws) => {
				console.debug("Connection closed", evt, ws);
			},
			onOpen: (evt, ws) => {
				console.debug("Connection opened", evt, ws);
			},
			onError: (evt, ws) => {
				console.error(evt, ws);
			},
		};
	}),
);

export default app;
