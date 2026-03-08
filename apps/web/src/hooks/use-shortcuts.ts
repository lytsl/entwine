import { useEffect } from "react";
import type { EventBusHandler } from "@/lib/event-bus";
import { type ShortcutKey, shortcutBus } from "@/lib/shortcut-registry";

export function useShortcut<K extends ShortcutKey>(
	key: K,
	handler: EventBusHandler<unknown>,
) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: handler is not reactive
	useEffect(() => {
		shortcutBus.on(key, handler);
		return () => {
			shortcutBus.off(key, handler);
		};
	}, [key]);
}
