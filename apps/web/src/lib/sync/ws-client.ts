export type ConnectionState = "connecting" | "connected" | "disconnected";

export interface WebSocketClientConfig {
	url: string;
	onMessage?: (event: MessageEvent) => void;
	reconnectInterval?: number;
	onStateChange?: (state: ConnectionState) => void;
}

export class WebSocketClient {
	public url: string;
	public onMessage?: (event: MessageEvent) => void;
	public reconnectInterval: number;
	public onStateChange: (state: ConnectionState) => void;

	public ws: WebSocket | null;
	public connectionState: ConnectionState;

	// Using ReturnType ensures compatibility across Node and Browser environments
	private reconnectTimer: ReturnType<typeof setTimeout> | null;

	constructor(config: WebSocketClientConfig) {
		this.url = config.url;
		this.onMessage = config.onMessage;
		this.reconnectInterval = config.reconnectInterval || 5000;
		this.onStateChange = config.onStateChange || (() => {});

		this.ws = null;
		this.reconnectTimer = null;
		this.connectionState = "disconnected";
	}

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
			if (this.onMessage) {
				this.onMessage(event);
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
			this.ws = null;
		}
	}
}
