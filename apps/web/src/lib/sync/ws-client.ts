import type { IDBPTransaction } from "idb";
import { syncEventBus } from "./events";

export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface WebSocketClientConfig {
	ws: WebSocket;
	reconnectInterval?: number;
	onStateChange?: (state: ConnectionState) => void;
}

export interface WsSyncData<T extends object = Record<string, unknown>> {
	id: number;
	modelName: string;
	modelId: string;
	action: "insert" | "update" | "delete";
	data: T;
}
export type WsSyncMessage<T extends object = Record<string, unknown>> = {
	cmd: "sync";
	sync: Array<WsSyncData<T>>;
	lastSyncId: number;
};
export type BulkWrite<T extends object = Record<string, unknown>> = (payload: {
	data: Array<WsSyncData<T>>;
	lastSyncId?: number;
	tx?: IDBPTransaction<unknown, string[], "readwrite">;
}) => void;

export class WebSocketClient {
	public reconnectInterval: number;
	public onStateChange: (state: ConnectionState) => void;

	public ws: WebSocket;
	public connectionState: ConnectionState = "disconnected";

	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(config: WebSocketClientConfig) {
		this.ws = config.ws;
		this.reconnectInterval = config.reconnectInterval || 5000;
		this.onStateChange = config.onStateChange || (() => {});

		this.connect();
	}

	private _updateState(newState: ConnectionState): void {
		this.connectionState = newState;
		this.onStateChange(newState);
	}

	public connect(): void {
		this._updateState("connecting");

		this.ws.onopen = () => {
			this._updateState("connected");
			this.ws?.send(JSON.stringify({ type: "sync" }));
		};

		this.ws.onmessage = (event: MessageEvent) => {
			const message: WsSyncMessage = JSON.parse(event.data);
			if (message.cmd === "sync") {
				const groupedMessages = Object.groupBy(
					message.sync,
					({ modelName }) => modelName,
				);
				for (const [modelName, data] of Object.entries(groupedMessages)) {
					syncEventBus.emit(`${modelName}:sync`, {
						data: data!,
						lastSyncId: message.lastSyncId,
					});
				}
			}
		};

		this.ws.onerror = (error: Event) => {
			console.error("WebSocket error:", error);
			this._updateState("disconnected");
		};

		this.ws.onclose = () => {
			this._updateState("disconnected");
			if (!this.reconnectTimer) {
				this.reconnectTimer = setTimeout(() => {
					this.reconnectTimer = null;
					this.connect();
				}, this.reconnectInterval);
			}
		};
	}

	public disconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.ws) {
			this.ws.close();
		}
	}
}
