"use client";

import { CheckIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { type Priority, priorities } from "@/mock-data/priorities";
import { useIssuesStore } from "@/store/issues-store";

interface PrioritySelectorProps {
	priority: Priority;
	onChange: (priority: Priority) => void;
}

export function PrioritySelector({
	priority,
	onChange,
}: PrioritySelectorProps) {
	const id = useId();
	const [open, setOpen] = useState<boolean>(false);
	const [value, setValue] = useState<string>(priority.id);

	const { filterByPriority } = useIssuesStore();

	useEffect(() => {
		setValue(priority.id);
	}, [priority.id]);

	const handlePriorityChange = (priorityId: string) => {
		setValue(priorityId);
		setOpen(false);

		const newPriority = priorities.find((p) => p.id === priorityId);
		if (newPriority) {
			onChange(newPriority);
		}
	};

	return (
		<div className="*:not-first:mt-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button
							id={id}
							className="flex items-center justify-center"
							size="xs"
							variant="secondary"
							role="combobox"
							aria-expanded={open}
						/>
					}
				>
					{(() => {
						const selectedItem = priorities.find((item) => item.id === value);
						if (selectedItem) {
							const Icon = selectedItem.icon;
							return <Icon className="size-4 text-muted-foreground" />;
						}
						return null;
					})()}
					<span>
						{value
							? priorities.find((p) => p.id === value)?.name
							: "No priority"}
					</span>
				</PopoverTrigger>
				<PopoverContent
					className="w-full min-w-[var(--radix-popper-anchor-width)] border-input p-0"
					align="start"
				>
					<Command>
						<CommandInput placeholder="Set priority..." />
						<CommandList>
							<CommandEmpty>No priority found.</CommandEmpty>
							<CommandGroup>
								{priorities.map((item) => (
									<CommandItem
										key={item.id}
										value={item.id}
										onSelect={() => handlePriorityChange(item.id)}
										className="flex items-center justify-between"
									>
										<div className="flex items-center gap-2">
											<item.icon className="size-4 text-muted-foreground" />
											{item.name}
										</div>
										{value === item.id && (
											<CheckIcon size={16} className="ml-auto" />
										)}
										<span className="text-muted-foreground text-xs">
											{filterByPriority(item.id).length}
										</span>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
