export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface WebSocketClientConfig {
	url: string;
	reconnectInterval?: number;
	onStateChange?: (state: ConnectionState) => void;
}

export type MessageListener = (event: MessageEvent) => void;

export class WebSocketClient {
	public url: string;
	public reconnectInterval: number;
	public onStateChange: (state: ConnectionState) => void;

	public ws: WebSocket | null = null;
	public connectionState: ConnectionState = "disconnected";

	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	// Store multiple listeners using a Set
	private messageListeners: Set<MessageListener> = new Set();

	constructor(config: WebSocketClientConfig) {
		this.url = config.url;
		this.reconnectInterval = config.reconnectInterval || 5000;
		this.onStateChange = config.onStateChange || (() => {});
	}

	// --- Listener Management ---

	public addMessageListener(listener: MessageListener): void {
		this.messageListeners.add(listener);
	}

	public removeMessageListener(listener: MessageListener): void {
		this.messageListeners.delete(listener);
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
		this.ws = new WebSocket(this.url);

		this.ws.onopen = () => {
			this._updateState("connected");
			// Request initial sync
			this.ws?.send(JSON.stringify({ type: "sync" }));
		};

		this.ws.onmessage = (event: MessageEvent) => {
			// Broadcast the event to all registered listeners
			this.messageListeners.forEach((listener) => {
				listener(event);
			});
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
			this.ws = null;
		}
	}
}
