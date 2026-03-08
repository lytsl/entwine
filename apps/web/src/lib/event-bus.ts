/**
 * Represents the key used to identify an event.
 */
type EventName = string;

/**
 * Defines the configuration and logic for a single event subscriber.
 */
export interface EventBusHandler<TPayload, N extends string = string> {
	/** If `true`, the handler is automatically unsubscribed after one execution. */
	once?: boolean;

	/**
	 * A unique identifier for the handler.
	 * Used to prevent duplicate registrations and for removing handlers by name.
	 */
	name?: N;

	/** * Execution priority.
	 * - Handlers with lower numbers execute first.
	 * - Handlers with the same number execute concurrently.
	 */
	order?: number;

	/** * If `true`, the EventBus will stop processing subsequent handlers
	 * (those with higher order numbers) after this handler executes.
	 * * @default false
	 */
	stopPropagation?: boolean;

	/** * The callback function to execute.
	 */
	handle(props: { name: N; payload: TPayload }): void | Promise<void>;
}

export class EventBus<TEvents extends Record<EventName, unknown>> {
	private readonly subscribers: Map<
		EventName,
		Array<EventBusHandler<unknown>>
	> = new Map();

	on<TName extends EventName>(
		eventName: TName,
		handler: EventBusHandler<TEvents[TName]>,
	): boolean {
		let registeredHandlers = this.subscribers.get(eventName);

		if (!registeredHandlers) {
			registeredHandlers = [];
			this.subscribers.set(eventName, registeredHandlers);
		}

		const isDuplicate = handler.name
			? registeredHandlers.some((existing) => existing.name === handler.name)
			: false;

		if (isDuplicate) return false;

		registeredHandlers.push(handler as EventBusHandler<unknown>);
		registeredHandlers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

		return true;
	}

	off<TName extends EventName>(
		eventName: TName,
		identifier: EventBusHandler<TEvents[TName]> | string,
	): boolean {
		return typeof identifier === "string"
			? this.filterSubscribers(eventName, (h) => h.name !== identifier)
			: this.filterSubscribers(eventName, (h) => h !== identifier);
	}

	async emit<TName extends EventName>(
		eventName: TName,
		payload: TEvents[TName],
	): Promise<void> {
		const registeredHandlers = this.subscribers.get(eventName);
		if (!registeredHandlers || registeredHandlers.length === 0) return;

		const handlersSnapshot = [...registeredHandlers];
		const handlersToCleanup: EventBusHandler<unknown>[] = [];

		let isStopped = false;
		let currentOrder = handlersSnapshot[0].order ?? 0;
		let concurrentBatch: Array<() => void | Promise<void>> = [];
		const executeBatch = async () => {
			if (concurrentBatch.length === 0) return;
			await Promise.allSettled(concurrentBatch.map((fn) => fn()));
			concurrentBatch = [];
		};

		for (const handler of handlersSnapshot) {
			const handlerOrder = handler.order ?? 0;

			// If the order changes, we must finish the previous batch first
			if (handlerOrder !== currentOrder) {
				await executeBatch();
				if (isStopped) break;
				currentOrder = handlerOrder;
			}

			concurrentBatch.push(async () => {
				await handler.handle({ name: eventName, payload });
			});

			if (handler.once) {
				handlersToCleanup.push(handler);
			}

			// We set the flag immediately, but it only affects the *next* batch (next order group)
			// because handlers in the *current* batch (same order) run concurrently.
			if (handler.stopPropagation) {
				isStopped = true;
			}
		}

		await executeBatch();

		if (handlersToCleanup.length > 0) {
			this.filterSubscribers(eventName, (h) => !handlersToCleanup.includes(h));
		}
	}

	private filterSubscribers(
		eventName: EventName,
		shouldKeep: (handler: EventBusHandler<unknown>) => boolean,
	): boolean {
		const currentHandlers = this.subscribers.get(eventName);
		if (!currentHandlers) return false;

		const remainingHandlers = currentHandlers.filter(shouldKeep);
		const didRemove = remainingHandlers.length < currentHandlers.length;

		if (remainingHandlers.length === 0) {
			this.subscribers.delete(eventName);
		} else if (didRemove) {
			this.subscribers.set(eventName, remainingHandlers);
		}

		return didRemove;
	}

	destroy() {
		this.subscribers.clear();
	}
}
