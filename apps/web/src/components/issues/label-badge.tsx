import { Badge } from "@/components/ui/badge";
import type { LabelInterface } from "@/mock-data/labels";

export function LabelBadge({ label }: { label: LabelInterface[] }) {
	return (
		<>
			{label.map((l) => (
				<Badge
					key={l.id}
					variant="outline"
					className="gap-1.5 rounded-full bg-background text-muted-foreground"
				>
					<span
						className="size-1.5 rounded-full"
						style={{ backgroundColor: l.color }}
						aria-hidden="true"
					/>
					{l.name}
				</Badge>
			))}
		</>
	);
}
