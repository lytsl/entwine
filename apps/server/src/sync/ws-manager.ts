// ws-manager.ts

import type { ServerWebSocket } from "bun";
import type { WSContext } from "hono/ws";

const s = {} as unknown as ServerWebSocket;
s.subscribe;

export class WebSocketManager {
	// Maps a topic string to a Set of active WebSocket contexts
	private topics: Map<string, Set<WSContext>> = new Map();

	/**
	 * Subscribes a WebSocket client to a specific topic.
	 */
	subscribe(topic: string, ws: WSContext) {
		if (!this.topics.has(topic)) {
			this.topics.set(topic, new Set());
		}
		this.topics.get(topic)!.add(ws);
		console.log(`Client subscribed to [${topic}]`);
	}

	/**
	 * Unsubscribes a WebSocket client from a specific topic.
	 */
	unsubscribe(topic: string, ws: WSContext) {
		const clients = this.topics.get(topic);
		if (clients) {
			clients.delete(ws);
			if (clients.size === 0) {
				this.topics.delete(topic); // Clean up empty topics
			}
		}
	}

	/**
	 * Removes a WebSocket client from all topics (used on disconnect).
	 */
	removeClient(ws: WSContext) {
		for (const [topic, clients] of this.topics.entries()) {
			clients.delete(ws);
			if (clients.size === 0) {
				this.topics.delete(topic);
			}
		}
	}

	/**
	 * Broadcasts a message to all clients subscribed to a specific topic.
	 */
	broadcast(topic: string, message: unknown) {
		const clients = this.topics.get(topic);
		if (clients) {
			const payload =
				typeof message === "string" ? message : JSON.stringify(message);
			for (const client of clients) {
				// Only send if the connection is still ready
				if (client.readyState === 1) {
					client.send(payload);
				}
			}
		}
	}
}
