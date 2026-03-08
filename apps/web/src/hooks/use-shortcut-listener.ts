import { useEffect, useRef } from "react";
import {
	createFingerprint,
	instantShortcuts,
	type ShortcutKey,
	sequenceStarters,
	shortcutBus,
	shortcutRegistry,
} from "@/lib/shortcut-registry";

const SEQ_TIMEOUT_MS = 1500;

export const useShortcutListener = () => {
	const buffer = useRef<{
		timestamp: number;
		nextIndex: number;
		candidates: ShortcutKey[];
	} | null>(null);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement;

			if (
				["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
				target.isContentEditable
			) {
				return;
			}

			const pressedKey = event.key.toLowerCase();
			const now = Date.now();

			const activeModifiers: string[] = [];
			if (event.ctrlKey) activeModifiers.push("ctrl");
			if (event.metaKey) activeModifiers.push("meta");
			if (event.altKey) activeModifiers.push("alt");
			if (event.shiftKey) activeModifiers.push("shift");

			const fingerprint = createFingerprint(activeModifiers, pressedKey);
			if (fingerprint && instantShortcuts.has(fingerprint)) {
				triggerShortcut(instantShortcuts.get(fingerprint)!, event);
				buffer.current = null;
				return;
			}

			// Check if we are advancing an existing sequence
			if (buffer.current) {
				const { timestamp, nextIndex, candidates } = buffer.current;

				if (now - timestamp <= SEQ_TIMEOUT_MS) {
					// Keep candidates where the key at [nextIndex] matches the key pressed
					const nextCandidates = candidates.filter((id) => {
						return shortcutRegistry[id].keys[nextIndex] === pressedKey;
					});

					if (nextCandidates.length > 0) {
						const exactMatch = nextCandidates.find((id) => {
							return shortcutRegistry[id].keys.length === nextIndex + 1;
						});
						if (exactMatch) {
							triggerShortcut(exactMatch, event);
							buffer.current = null;
						} else {
							buffer.current = {
								timestamp: now,
								nextIndex: nextIndex + 1,
								candidates: nextCandidates,
							};
						}
						return;
					}
				}

				// If we reach here, the key did NOT match the sequence (or timed out).
				buffer.current = null;
			}

			// Check if we are starting a NEW sequence
			if (sequenceStarters.has(pressedKey)) {
				const candidates = sequenceStarters.get(pressedKey)!;

				const singleKeyMatch = candidates.find(
					(id) => shortcutRegistry[id].keys.length === 1,
				);
				if (singleKeyMatch) {
					triggerShortcut(singleKeyMatch, event);
				} else {
					buffer.current = {
						timestamp: now,
						nextIndex: 1,
						candidates: candidates,
					};
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);
};

function triggerShortcut(id: ShortcutKey, event: KeyboardEvent) {
	event.preventDefault();
	event.stopPropagation();
	shortcutBus.emit(id, undefined);
	console.log(`[Shortcut] Emitted: ${id}`);
}
