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
import { status as allStatus, type IssueStatus } from "@/mock-data/status";
import { useIssuesStore } from "@/store/issues-store";

type SelectorProps<TItem extends { id: string; name: string }> = {
	value: string;
	onChange: (status: TItem) => void;
	options: TItem[];
} & ({ optionsIconMap: Record<string, any>; optionsIconKey: keyof TItem } | {});

export function Selector<TItem extends { id: string; name: string }>({
	value: _value,
	onChange,
	options,
	...props
}: SelectorProps<TItem>) {
	const id = useId();
	const [open, setOpen] = useState<boolean>(false);
	const [value, setValue] = useState<string>(_value);
	const [selectedItem, setSelectedItem] = useState(() =>
		options.find((s) => s.id === _value),
	);

	const { filterByStatus } = useIssuesStore();

	useEffect(() => {
		setValue(_value);
	}, [_value]);

	const handleStatusChange = (newItem: TItem) => {
		setValue(newItem.id);
		setSelectedItem(newItem);
		setOpen(false);
		onChange(newItem);
	};

	const SelectedIcon =
		"optionsIconMap" in props &&
		selectedItem?.[props.optionsIconKey] &&
		props.optionsIconMap[selectedItem?.[props.optionsIconKey]];

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
					{SelectedIcon && <SelectedIcon />}
					<span>{selectedItem?.name}</span>
				</PopoverTrigger>
				<PopoverContent
					className="w-full min-w-[var(--radix-popper-anchor-width)] border-input p-0"
					align="start"
				>
					<Command>
						<CommandInput placeholder="Set status..." />
						<CommandList>
							<CommandEmpty>No status found.</CommandEmpty>
							<CommandGroup>
								{options.map((item) => {
									const Icon =
										"optionsIconMap" in props &&
										props.optionsIconMap[item?.[props.optionsIconKey]];
									return (
										<CommandItem
											key={item.id}
											value={item.id}
											onSelect={() => handleStatusChange(item)}
											className="flex items-center justify-between"
										>
											<div className="flex items-center gap-2">
												{Icon && <Icon />}
												{item.name}
											</div>
											{value === item.id && (
												<CheckIcon size={16} className="ml-auto" />
											)}
											<span className="text-muted-foreground text-xs">
												{0}
												{/*Issue Count By Status*/}
											</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</div>
	);
}
