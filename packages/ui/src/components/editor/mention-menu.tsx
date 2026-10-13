import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import { createPortal } from "react-dom";
import { UserAvatar } from "../ui/user-avatar";
import type { MentionPerson } from "./mention";

export type MentionState = {
  element: HTMLElement;
  props: SuggestionProps<MentionPerson, MentionPerson>;
  index: number;
};

/** People the menu lists at once. */
const SHOWN = 8;

function findPeople(people: readonly MentionPerson[], query: string): MentionPerson[] {
  const q = query.trim().toLowerCase();
  return people.filter((person) => person.suggested && person.name.toLowerCase().includes(q)).slice(0, SHOWN);
}

/** `@` and a name. Its state is held outside React, as the block menu's is, for the plugin's key handler. */
export function mentionSuggestions(
  people: () => readonly MentionPerson[],
  setState: (update: (state: MentionState | null) => MentionState | null) => void,
) {
  let current: MentionState | null = null;
  let unmount: (() => void) | undefined;
  const set = (next: MentionState | null) => {
    current = next;
    setState(() => next);
  };
  return Extension.create({
    name: "mentionSuggestions",
    addProseMirrorPlugins() {
      return [
        Suggestion<MentionPerson, MentionPerson>({
          editor: this.editor,
          // The block menu is a suggestion too, and two cannot share a key.
          pluginKey: new PluginKey("mentionSuggestions"),
          char: "@",
          items: ({ query }) => findPeople(people(), query),
          command: ({ editor, range, props }) =>
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: "mention", attrs: { id: props.id, label: props.name } },
                { type: "text", text: " " },
              ])
              .run(),
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

export function MentionMenu({ state }: { state: MentionState }) {
  const { items, command } = state.props;
  // A name nobody has closes the menu, and leaves the text as typed.
  if (!items.length) return null;
  return createPortal(
    <div
      role="listbox"
      aria-label="Mention a member"
      className="flex max-h-80 w-56 flex-col overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/10 dark:shadow-black/40"
    >
      {items.map((person, index) => (
        <button
          key={person.id}
          type="button"
          role="option"
          aria-selected={index === state.index}
          className="flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-left text-body hover:bg-accent aria-selected:bg-accent"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => command(person)}
        >
          <UserAvatar user={person} size={18} />
          <span className="truncate">{person.name}</span>
        </button>
      ))}
    </div>,
    state.element,
  );
}
