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
	// transactionId?: string;
}
export type WsSyncMessage<T extends object = Record<string, unknown>> = {
	cmd: "sync";
	sync: Array<WsSyncData<T>>;
	lastSyncId: number;
};
export type MessageListener<T extends object = Record<string, unknown>> = (
	data: WsSyncMessage<T>,
) => void;

export class WebSocketClient {
	public reconnectInterval: number;
	public onStateChange: (state: ConnectionState) => void;

	public ws: WebSocket;
	public connectionState: ConnectionState = "disconnected";

	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	// Store multiple listeners using a Set
	private messageListeners = new Map<string, Set<MessageListener<any>>>();

	constructor(config: WebSocketClientConfig) {
		this.ws = config.ws;
		this.reconnectInterval = config.reconnectInterval || 5000;
		this.onStateChange = config.onStateChange || (() => {});

		this.connect();
	}

	// --- Listener Management ---

	public addMessageListener<T extends object = Record<string, unknown>>(
		eventFilter: { modelName: string },
		listener: MessageListener<T>,
	): void {
		const listeners =
			this.messageListeners.get(eventFilter.modelName) || new Set();
		listeners.add(listener);
		this.messageListeners.set(eventFilter.modelName, listeners);
	}

	public removeMessageListener<T extends object = Record<string, unknown>>(
		eventFilter: { modelName: string },
		listener: MessageListener<T>,
	): void {
		const listeners = this.messageListeners.get(eventFilter.modelName);
		if (!listeners) return;
		listeners.delete(listener);
		if (!listeners.size) {
			this.messageListeners.delete(eventFilter.modelName);
		}
	}

	public clearAllListeners(): void {
		this.messageListeners.clear();
	}

	// --- Connection Management ---

	private _updateState(newState: ConnectionState): void {
		this.connectionState = newState;
		this.onStateChange(newState);
	}

	public connect(): void {
		this._updateState("connecting");
		// this.ws = new WebSocket(this.url);

		this.ws.onopen = () => {
			this._updateState("connected");
			// Request initial sync
			this.ws?.send(JSON.stringify({ type: "sync" }));
		};

		this.ws.onmessage = (event: MessageEvent) => {
			const message: WsSyncMessage = JSON.parse(event.data);
			// Broadcast the event to all registered listeners
			if (message.cmd === "sync") {
				const groupedMessages = Object.groupBy(
					message.sync,
					({ modelName }) => modelName,
				);
				for (const [modelName, sync] of Object.entries(groupedMessages)) {
					const listeners = this.messageListeners.get(modelName);
					if (!listeners) continue;
					for (const listener of listeners) {
						listener({ ...message, sync: sync! });
					}
				}
			}
		};

		this.ws.onerror = (error: Event) => {
			console.error("WebSocket error:", error);
			this._updateState("disconnected");
		};

		this.ws.onclose = () => {
			this._updateState("disconnected");
			// Auto-reconnect
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
			// this.ws = null;
		}
	}
}
