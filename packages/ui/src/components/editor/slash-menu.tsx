import { Extension } from "@tiptap/core";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import { createPortal } from "react-dom";
import { type Block, findBlocks } from "./blocks";

export type SlashState = { element: HTMLElement; props: SuggestionProps<Block, Block>; index: number };

/** Holds the menu's state outside React so the plugin's key handler reads the latest of it. */
export function slashCommands(setState: (update: (state: SlashState | null) => SlashState | null) => void) {
  let current: SlashState | null = null;
  let unmount: (() => void) | undefined;
  const set = (next: SlashState | null) => {
    current = next;
    setState(() => next);
  };
  return Extension.create({
    name: "slashCommands",
    addProseMirrorPlugins() {
      return [
        Suggestion<Block, Block>({
          editor: this.editor,
          char: "/",
          items: ({ query }) => findBlocks(query),
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => ({
            onStart(props) {
              const element = document.createElement("div");
              element.style.zIndex = "60";
              unmount = props.mount(element, {});
              set({ element, props, index: 0 });
            },
            onUpdate(props) {
              if (current) set({ ...current, props, index: 0 });
            },
            onKeyDown({ event }) {
              if (!current) return false;
              const { items, command } = current.props;
              if (!items.length) return false;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const step = event.key === "ArrowDown" ? 1 : -1;
                set({ ...current, index: (current.index + step + items.length) % items.length });
                return true;
              }
              if (event.key === "Enter" || event.key === "Tab") {
                command(items[current.index]!);
                return true;
              }
              return false;
            },
            onExit() {
              unmount?.();
              unmount = undefined;
              set(null);
            },
          }),
        }),
      ];
    },
  });
}

export function SlashMenu({ state }: { state: SlashState }) {
  const { items, command } = state.props;
  // Text that matches no block closes the menu, and leaves the text as typed.
  if (!items.length) return null;
  return createPortal(
    <div
      role="listbox"
      aria-label="Insert block"
      className="flex max-h-80 w-56 flex-col overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/10 dark:shadow-black/40"
    >
      {items.map((block, index) => (
        <button
          key={block.label}
          type="button"
          role="option"
          aria-selected={index === state.index}
          className="flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-body hover:bg-accent aria-selected:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command(block)}
        >
          <block.icon />
          {block.label}
        </button>
      ))}
    </div>,
    state.element,
  );
}
