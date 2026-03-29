import { useLiveQuery } from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/test")({
	beforeLoad: async () => {
		type TMetadataDb = IDBPDatabase<
			DBSchema &
				Record<
					"_metadata",
					{
						key: string;
						value: { lastSyncId: number };
					}
				>
		>;
		const syncData = await (db as TMetadataDb).get("_metadata", "syncData");
		let lastSyncId = syncData?.lastSyncId ?? 0;

		issueCollection.startSyncImmediate();

		const apiData = await api
			.get("delta", {
				searchParams: { lastSyncId },
			})
			.json();

		if (Array.isArray(apiData) && apiData.length > 0) {
			const tx = db.transaction(["issue", "_metadata"], "readwrite");
			const metadataStore = tx.objectStore("_metadata");

			await Promise.all(
				[
					apiData.map((item) => {
						lastSyncId = Math.max(lastSyncId, item.id);
						return syncEventBus.emit(`${item.modelName}:sync`, {
							data: [item],
							tx,
						});
					}),
					metadataStore.put({ lastSyncId }, "syncData"),
				].flat(),
			);
		}

		await Promise.all(
			["issue"].map((modelName) => {
				syncEventBus.emit(`${modelName}:markReady`, { lastSyncId });
			}),
		);
	},
	component: DraggableItemTable,
});

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
	draggable,
	dropTargetForElements,
	monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { DBSchema, IDBPDatabase } from "idb";
import { LexoRank } from "lexorank";
import { GripVertical, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { issueCollection } from "@/collections/issue";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { syncEventBus } from "@/lib/sync/events";
import { api } from "@/utils/api";

// import { issueCollection } from "@/collections/issue";

// --- Types ---
interface Item {
	id: string;
	title: string;
	description: string;
	rank: string; // Added LexoRank field
}

// --- Mock Initial Data ---
// Generate sequential ranks for initial data
const rank1 = LexoRank.middle();
const rank2 = rank1.genNext();
const rank3 = rank2.genNext();
const rank4 = rank3.genNext();
const rank5 = rank4.genNext();

const INITIAL_DATA: Item[] = [
	{
		id: "1",
		title: "React",
		description: "UI library",
		rank: rank1.toString(),
	},
	{
		id: "2",
		title: "Tailwind CSS",
		description: "CSS framework",
		rank: rank2.toString(),
	},
	{
		id: "3",
		title: "Shadcn UI",
		description: "UI components",
		rank: rank3.toString(),
	},
	{
		id: "4",
		title: "TypeScript",
		description: "Typed JS",
		rank: rank4.toString(),
	},
	{
		id: "5",
		title: "Pragmatic DnD",
		description: "Drag and Drop",
		rank: rank5.toString(),
	},
];

// --- Sub-component: Draggable Row ---
const DraggableRow = ({
	item,
	updateItem,
}: {
	item: Item;
	updateItem: (id: string, field: keyof Item, value: string) => void;
}) => {
	const rowRef = useRef<HTMLTableRowElement>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);

	useEffect(() => {
		const el = rowRef.current;
		if (!el) return;

		return combine(
			draggable({
				element: el,
				getInitialData: () => ({ id: item.id }),
				onDragStart: () => setIsDragging(true),
				onDrop: () => setIsDragging(false),
			}),
			dropTargetForElements({
				element: el,
				getData: () => ({ id: item.id }),
				onDragEnter: () => setIsDragOver(true),
				onDragLeave: () => setIsDragOver(false),
				onDrop: () => setIsDragOver(false),
			}),
		);
	}, [item.id]);

	return (
		<TableRow
			ref={rowRef}
			className={`transition-colors ${isDragging ? "bg-muted opacity-50" : ""} ${
				isDragOver ? "border-t-2 border-t-primary" : ""
			}`}
		>
			<TableCell className="w-[50px]">
				<div className="inline-block cursor-grab rounded-md p-2 hover:bg-muted active:cursor-grabbing">
					<GripVertical className="h-4 w-4 text-muted-foreground" />
				</div>
			</TableCell>
			<TableCell>
				<Input
					value={item.title}
					onChange={(e) => updateItem(item.id, "title", e.target.value)}
					className="border-transparent shadow-none transition-colors hover:border-input focus:border-input"
				/>
			</TableCell>
			<TableCell>
				<Input
					value={item.description}
					onChange={(e) => updateItem(item.id, "description", e.target.value)}
					className="border-transparent shadow-none transition-colors hover:border-input focus:border-input"
				/>
			</TableCell>
		</TableRow>
	);
};

// --- Main Component ---
export default function DraggableItemTable() {
	const [items, setItems] = useState<Item[]>(INITIAL_DATA);
	const [searchQuery, setSearchQuery] = useState("");

	// Dialog State
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newDescription, setNewDescription] = useState("");

	// Handle global drag-and-drop LexoRank calculations
	useEffect(() => {
		return monitorForElements({
			onDrop({ source, location }) {
				const destination = location.current.dropTargets[0];
				if (!destination) return;

				const sourceId = source.data.id as string;
				const destinationId = destination.data.id as string;

				if (sourceId === destinationId) return;

				setItems((prevItems) => {
					const sourceIndex = prevItems.findIndex((i) => i.id === sourceId);
					const destinationIndex = prevItems.findIndex(
						(i) => i.id === destinationId,
					);

					if (sourceIndex === -1 || destinationIndex === -1) return prevItems;

					// Temporarily rearrange array to find new neighbors
					const newItems = [...prevItems];
					const [movedItem] = newItems.splice(sourceIndex, 1);
					newItems.splice(destinationIndex, 0, movedItem);

					// Get the items immediately before and after the drop location
					const prevItem = newItems[destinationIndex - 1];
					const nextItem = newItems[destinationIndex + 1];

					let newRank: LexoRank;

					if (!prevItem && !nextItem) {
						// It's the only item in the list
						newRank = LexoRank.middle();
					} else if (!prevItem) {
						// Moved to the very top
						newRank = LexoRank.parse(nextItem.rank).genPrev();
					} else if (!nextItem) {
						// Moved to the very bottom
						newRank = LexoRank.parse(prevItem.rank).genNext();
					} else {
						// Moved exactly between two items
						newRank = LexoRank.parse(prevItem.rank).between(
							LexoRank.parse(nextItem.rank),
						);
					}

					// Apply the new rank string
					movedItem.rank = newRank.toString();

					// Return the array explicitly sorted by the LexoRank strings
					return newItems.sort((a, b) =>
						a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0,
					);
				});
			},
		});
	}, []);

	// Update specific fields of an item
	const _handleUpdateItem0 = (id: string, field: keyof Item, value: string) => {
		setItems((prev) =>
			prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
		);
	};
	const handleUpdateItem = (id: string, field: keyof Item, value: string) => {
		return issueCollection.update(id, (draft) => {
			draft[field] = value;
		});
	};

	// Create a new item at the bottom of the list
	const handleAddItem = () => {
		if (!newTitle.trim() || !newDescription.trim()) return;

		// Determine the rank for the new item (appended to the bottom)
		let newRankStr = LexoRank.middle().toString();
		if (items.length > 0) {
			const lastItem = items[items.length - 1];
			newRankStr = LexoRank.parse(lastItem.rank).genNext().toString();
		}

		const newItem: Item = {
			// id: Date.now().toString(),
			title: newTitle.trim(),
			description: newDescription.trim(),
			rank: newRankStr,
		};

		// setItems((prev) => {
		// 	const updated = [...prev, newItem];
		// 	return updated.sort((a, b) =>
		// 		a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0,
		// 	);
		// });
		issueCollection.insert({
			...newItem,
			// createdAt: new Date(),
			// updatedAt: new Date(),
			// deletedAt: new Date(),
			// hlc: "hlc",
		});

		setNewTitle("");
		setNewDescription("");
		setIsDialogOpen(false);
		setSearchQuery("");
	};

	// Filter items based on search
	const _filteredItems0 = items.filter(
		(item) =>
			item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			item.description.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	const filteredItems = useLiveQuery({
		query: (q) =>
			q
				.from({ issue: issueCollection })
				// .where(({ issue }) => like(issue.title, searchQuery))
				.orderBy(({ issue }) => issue.rank, "asc")
				.limit(10),
	});

	const _items1 = useLiveQuery({
		query: (q) => q.from({ issue: issueCollection }),
	});

	return (
		<div className="mx-auto w-full max-w-4xl space-y-4 p-4">
			<div className="flex items-center justify-between space-x-2">
				<Input
					placeholder="Search items..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="max-w-sm"
				/>

				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger render={<Button />}>
						<Plus className="mr-2 h-4 w-4" />
						Add Item
					</DialogTrigger>
					<DialogContent className="sm:max-w-[425px]">
						<DialogHeader>
							<DialogTitle>Add New Item</DialogTitle>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="title" className="text-right">
									Title
								</Label>
								<Input
									id="title"
									value={newTitle}
									onChange={(e) => setNewTitle(e.target.value)}
									className="col-span-3"
									placeholder="e.g. Node.js"
								/>
							</div>
							<div className="grid grid-cols-4 items-center gap-4">
								<Label htmlFor="description" className="text-right">
									Description
								</Label>
								<Input
									id="description"
									value={newDescription}
									onChange={(e) => setNewDescription(e.target.value)}
									className="col-span-3"
									placeholder="e.g. JavaScript runtime"
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								onClick={handleAddItem}
								disabled={!newTitle.trim() || !newDescription.trim()}
							>
								Save Item
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[50px]" />
							<TableHead>Item Title</TableHead>
							<TableHead>Description</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredItems.data.length > 0 ? (
							filteredItems.data.map((item) => (
								<DraggableRow
									key={item.id}
									item={item}
									updateItem={handleUpdateItem}
								/>
							))
						) : (
							<TableRow>
								<TableCell colSpan={3} className="h-24 text-center">
									No items found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
