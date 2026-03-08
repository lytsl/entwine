import { Fragment } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import type { ShortcutRegistryItem } from "@/lib/shortcut-registry";

const SYMBOL_MAP: Record<string, string> = {
	ctrl: "Ctrl",
	control: "Ctrl",
	meta: "⌘",
	cmd: "⌘",
	command: "⌘",
	shift: "⇧",
	alt: "⌥",
	option: "⌥",
	enter: "↵",
	backspace: "⌫",
	delete: "Del",
	escape: "Esc",
	esc: "Esc",
	tab: "Tab",
	capslock: "Caps",
};

const formatKey = (key: string) => {
	const lower = key.toLowerCase();
	if (SYMBOL_MAP[lower]) return SYMBOL_MAP[lower];
	return lower.length === 1 ? lower.toUpperCase() : key;
};

type ShortcutDisplayProps = Omit<
	React.ComponentProps<typeof KbdGroup>,
	"children"
> & {
	shortcut: ShortcutRegistryItem;
};

export function ShortcutDisplay({ shortcut, ...props }: ShortcutDisplayProps) {
	const separator = shortcut.type === "sequential" ? "then" : "+";

	return (
		<div className="flex items-center gap-2">
			<span>{shortcut.name}</span>
			<KbdGroup {...props}>
				{shortcut.keys.map((key, index) => {
					const isLast = index === shortcut.keys.length - 1;
					return (
						<Fragment key={key}>
							<Kbd>{formatKey(key)}</Kbd>
							{!isLast && (
								<span className="text-muted-foreground text-xs">
									{separator}
								</span>
							)}
						</Fragment>
					);
				})}
			</KbdGroup>
		</div>
	);
}
