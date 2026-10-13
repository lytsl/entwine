import type { Store } from "../../../../store";

export function LabelChips({ store, labelIds }: { store: Store; labelIds: string[] }) {
  return (
    <>
      {labelIds.map((id) => {
        const label = store.labels.get(id);
        return label ? (
          <span
            key={id}
            className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-caption text-foreground"
          >
            <span className="size-2 rounded-full" style={{ background: label.color }} />
            {label.name}
          </span>
        ) : null;
      })}
    </>
  );
}
