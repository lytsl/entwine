import { CommandItem } from "@entwine/ui/components/ui/command";
import { type PropertyFace, PropertyPlaceholder, PropertySelect } from "@entwine/ui/components/ui/property-select";
import { PlusIcon, TagIcon } from "lucide-react";
import { LABEL_COLORS } from "../../../../constants/label";
import { labelOptions } from "../../../../lib/issue-options";
import { type Store } from "../../../../store";

function LabelDots({ store, ids }: { store: Store; ids: string[] }) {
  return (
    <span className="flex -space-x-0.5">
      {ids.slice(0, 3).map((id) => (
        <span
          key={id}
          className="size-2 rounded-full ring-2 ring-background"
          style={{ background: store.labels.get(id)?.color }}
        />
      ))}
    </span>
  );
}

export function LabelPicker({
  store,
  selected,
  onToggle,
  face = "pill",
}: {
  store: Store;
  selected: string[];
  onToggle(labelId: string): void;
  face?: PropertyFace;
}) {
  const only = selected.length === 1 ? store.labels.get(selected[0]) : undefined;
  const names = selected.map((id) => store.labels.get(id)?.name).filter(Boolean);
  return (
    <PropertySelect<string>
      label={selected.length ? `Labels: ${names.join(", ")}` : "Labels"}
      tooltip={selected.length > 1 ? names.join(", ") : undefined}
      face={face}
      multiple
      searchPlaceholder="Find or create a label…"
      emptyText="No labels"
      options={() => labelOptions(store)}
      isSelected={(id) => selected.includes(id)}
      onSelect={onToggle}
      extra={(search) => {
        const name = search.trim();
        if (!name || store.labels.find(name)) return null;
        return (
          <CommandItem
            className="text-body"
            onSelect={() =>
              onToggle(store.labels.create(name, LABEL_COLORS[store.labels.sorted.length % LABEL_COLORS.length]))
            }
          >
            <PlusIcon />
            Create “{name}”
          </CommandItem>
        );
      }}
    >
      {face === "icon" ? (
        <PlusIcon />
      ) : selected.length === 0 ? (
        <>
          <TagIcon className="text-muted-foreground" />
          {face === "pill" ? "Labels" : <PropertyPlaceholder>Add labels</PropertyPlaceholder>}
        </>
      ) : (
        <>
          <LabelDots store={store} ids={selected} />
          <span className="truncate">{only ? only.name : `${selected.length} labels`}</span>
        </>
      )}
    </PropertySelect>
  );
}
