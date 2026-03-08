import { EventBus } from "./event-bus";

const MODIFIER_KEYS = new Set([
	"control",
	"ctrl",
	"meta",
	"cmd",
	"alt",
	"option",
	"shift",
]);

export const createFingerprint = (
	modifiers: string[],
	mainKey: string,
): string | null => {
	const key = mainKey.toLowerCase();
	if (MODIFIER_KEYS.has(key)) return null;

	const parts = [
		modifiers.some((m) => ["ctrl", "control"].includes(m)) ? "ctrl" : "",
		modifiers.some((m) => ["meta", "cmd", "command"].includes(m)) ? "meta" : "",
		modifiers.some((m) => ["alt", "option"].includes(m)) ? "alt" : "",
		modifiers.some((m) => ["shift"].includes(m)) ? "shift" : "",
		key,
	].filter(Boolean);

	return parts.join("+");
};

export const shortcutsDetailsMap = {
	"CTRL+SHIFT+B": { name: "ctrl shift b" },
	"CTRL+K": { name: "Open command menu" },
	"G->B": { name: "Go to Blog" },
	"G->N": { name: "Go to News" },
	"A->B->C": { name: "Three step sequence" },

	"G->I": { name: "Go to inbox" },
} as const;

type ShortcutMap = typeof shortcutsDetailsMap;
export type ShortcutKey = keyof ShortcutMap;

export type ShortcutRegistryItem = {
	name: string;
	keys: string[];
	type: "sequential" | "simultaneous";
};

export type ShortcutRegistry = Record<ShortcutKey, ShortcutRegistryItem>;

export const instantShortcuts = new Map<string, ShortcutKey>();
export const sequenceStarters = new Map<string, ShortcutKey[]>();

function createRegistry(map: ShortcutMap): ShortcutRegistry {
	const out: Partial<ShortcutRegistry> = {};

	(Object.keys(map) as ShortcutKey[]).forEach((key) => {
		const isSequential = key.includes("->");

		const rawKeys = isSequential
			? key.split("->").map((k) => k.trim().toLowerCase())
			: key.split("+").map((k) => k.trim().toLowerCase());

		if (isSequential) {
			const leaderKey = rawKeys[0];
			const existing = sequenceStarters.get(leaderKey) || [];
			sequenceStarters.set(leaderKey, [...existing, key]);
		} else {
			const modifiers = rawKeys.filter((k) => MODIFIER_KEYS.has(k));
			const mainKey = rawKeys.find((k) => !MODIFIER_KEYS.has(k)) || "";

			const fingerprint = createFingerprint(modifiers, mainKey);
			if (fingerprint) instantShortcuts.set(fingerprint, key);
		}

		out[key] = {
			...map[key],
			keys: rawKeys,
			type: isSequential ? "sequential" : "simultaneous",
		};
	});

	return out as ShortcutRegistry;
}

export const shortcutRegistry = createRegistry(shortcutsDetailsMap);
export const shortcutBus = new EventBus<Record<ShortcutKey, unknown>>();
