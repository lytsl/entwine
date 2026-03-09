import { useCallback, useEffect, useRef, useState } from "react";

export enum ReadyState {
	CONNECTING = "CONNECTING",
	OPEN = "OPEN",
	CLOSING = "CLOSING",
	CLOSED = "CLOSED",
	UNINSTANTIATED = "UNINSTANTIATED",
}

export interface UseWebSocketOptions {
	onOpen?: (event: Event) => void;
	onClose?: (event: CloseEvent) => void;
	onMessage?: (event: MessageEvent) => void;
	onError?: (event: Event) => void;
	shouldReconnect?: boolean;
	maxReconnectAttempts?: number;
	reconnectInterval?: number;
}

export const useWebSocket = (
	url: string,
	options: UseWebSocketOptions = {},
) => {
	const {
		onOpen,
		onClose,
		onMessage,
		onError,
		shouldReconnect = true,
		maxReconnectAttempts = 5,
		reconnectInterval = 1000,
	} = options;

	const [readyState, setReadyState] = useState<ReadyState>(
		ReadyState.UNINSTANTIATED,
	);

	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttemptsRef = useRef<number>(0);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isIntentionallyClosed = useRef<boolean>(false);

	// Keep references to the latest callbacks to prevent unnecessary reconnections
	// when inline functions are passed to the hook.
	const callbacksRef = useRef({ onOpen, onClose, onMessage, onError });
	useEffect(() => {
		callbacksRef.current = { onOpen, onClose, onMessage, onError };
	});

	const connect = useCallback(() => {
		if (wsRef.current?.readyState === WebSocket.OPEN) return;

		setReadyState(ReadyState.CONNECTING);
		wsRef.current = new WebSocket(url);

		wsRef.current.onopen = (event) => {
			setReadyState(ReadyState.OPEN);
			reconnectAttemptsRef.current = 0;
			callbacksRef.current.onOpen?.(event);
		};

		wsRef.current.onmessage = (event) => {
			// Directly trigger the callback without holding state in the hook
			callbacksRef.current.onMessage?.(event);
		};

		wsRef.current.onerror = (event) => {
			callbacksRef.current.onError?.(event);
		};

		wsRef.current.onclose = (event) => {
			setReadyState(ReadyState.CLOSED);
			callbacksRef.current.onClose?.(event);

			// Handle Reconnection
			if (
				!isIntentionallyClosed.current &&
				shouldReconnect &&
				reconnectAttemptsRef.current < maxReconnectAttempts
			) {
				const timeout = reconnectInterval * 2 ** reconnectAttemptsRef.current;

				reconnectTimeoutRef.current = setTimeout(
					() => {
						reconnectAttemptsRef.current += 1;
						connect();
					},
					Math.min(timeout, 30000),
				);
			}
		};
	}, [url, shouldReconnect, maxReconnectAttempts, reconnectInterval]);

	// Connect on mount, cleanup on unmount
	useEffect(() => {
		connect();

		return () => {
			isIntentionallyClosed.current = true;
			if (wsRef.current) {
				wsRef.current.close();
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [connect]);

	const sendMessage = useCallback((message: string | object) => {
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			const formattedMessage =
				typeof message === "string" ? message : JSON.stringify(message);
			wsRef.current.send(formattedMessage);
		} else {
			console.warn("WebSocket is not connected. Message not sent.");
		}
	}, []);

	const disconnect = useCallback(() => {
		isIntentionallyClosed.current = true;
		if (wsRef.current) {
			wsRef.current.close();
		}
	}, []);

	return {
		sendMessage,
		disconnect,
		readyState,
		isConnected: readyState === ReadyState.OPEN,
	};
};
