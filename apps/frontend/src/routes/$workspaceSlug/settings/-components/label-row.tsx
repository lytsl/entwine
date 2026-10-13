import { Button } from "@entwine/ui/components/ui/button";
import { toast } from "@entwine/ui/components/ui/toast";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useStore } from "../../../../hooks/use-store";
import { type Label } from "../../../../types/rows";
import { LabelForm } from "./label-form";

export function LabelRow({ label, uses }: { label: Label; uses: number }) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <LabelForm
        label={label}
        submitLabel="Save"
        onCancel={() => setEditing(false)}
        onSubmit={(name, color) => {
          const other = store.labels.find(name);
          if (other && other.id !== label.id) {
            toast.error(`Label ${name} already exists`);
            return false;
          }
          void store.labels.update(label.id, { name, color });
          setEditing(false);
          return true;
        }}
      />
    );
  return (
    <li
      aria-label={label.name}
      className="group/label flex h-11 items-center gap-3 border-b px-4 transition-colors hover:bg-accent/40"
    >
      <span className="size-3 rounded-full" style={{ background: label.color }} />
      <span className="text-body font-medium">{label.name}</span>
      <span className="text-caption text-muted-foreground">
        {uses} {uses === 1 ? "issue" : "issues"}
      </span>
      <span className="ml-auto flex items-center gap-0.5 hover-reveal group-hover/label:opacity-100 focus-within:opacity-100">
        <Button variant="ghost" size="icon-xs" aria-label={`Edit ${label.name}`} onClick={() => setEditing(true)}>
          <PencilIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Delete ${label.name}`}
          onClick={() => store.labels.delete(label.id)}
        >
          <Trash2Icon />
        </Button>
      </span>
    </li>
  );
}
