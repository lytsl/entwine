import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { linkTarget } from "../../lib/markdown";

export function LinkPrompt({ editor, initial, onDone }: { editor: Editor; initial: string; onDone(): void }) {
  const [value, setValue] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  // The chain is built only once the address is accepted: `focus()` moves focus as soon as it is chained, which
  // would close the prompt on a refused address.
  const apply = () => {
    const href = value.trim() ? linkTarget(value) : "";
    if (href === null) return setInvalid(true);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    onDone();
  };
  return (
    <form
      className="flex items-center gap-1 px-1"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <input
        autoFocus
        aria-label="Link address"
        aria-invalid={invalid}
        placeholder="Paste or type a link…"
        className="h-7 w-64 rounded-md bg-transparent px-2 text-body outline-none placeholder:text-muted-foreground aria-invalid:text-destructive max-md:text-base"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setInvalid(false);
        }}
        onBlur={onDone}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          editor.commands.focus();
          onDone();
        }}
      />
      {invalid && <span className="pr-1 text-caption text-destructive">Web or mail addresses only</span>}
    </form>
  );
}
