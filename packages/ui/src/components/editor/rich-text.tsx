/** Rich text kept as Markdown. It knows nothing about what the text belongs to: the caller decides when to save. */
import { cn } from "@entwine/ui/lib/utils";
import { type Editor, Extension } from "@tiptap/core";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { EditorView } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { useEffect, useMemo, useRef, useState } from "react";
import { isSafeUrl, normalizeMarkdown } from "../../lib/markdown";
import type { RichTextFiles } from "../../lib/rich-text-files";
import { fileImage, insertFiles } from "./file-image";
import { type MentionPerson, mentionNode, showMentionNames } from "./mention";
import { MentionMenu, type MentionState, mentionSuggestions } from "./mention-menu";
import { refusedLinks } from "./refused-links";
import { SelectionToolbar } from "./selection-toolbar";
import { SlashMenu, type SlashState, slashCommands } from "./slash-menu";

("use client");

const lowlight = createLowlight(common);

/** Plain text written in Markdown goes in formatted; rich clipboards, code and lone URLs keep TipTap's handling. */
function pasteMarkdown(editor: Editor, event: ClipboardEvent): boolean {
  const clipboard = event.clipboardData;
  if (!clipboard || clipboard.getData("text/html") || editor.isActive("codeBlock") || editor.isActive("code"))
    return false;
  const text = clipboard.getData("text/plain");
  // A lone URL is left to the link extension, which links a selection or inserts it as a link.
  if (!text || !editor.markdown || /^\S+:\/\/\S+$/.test(text.trim())) return false;
  const doc = editor.markdown.parse(text);
  const blocks = doc.content ?? [];
  const formatted = (nodes: typeof blocks): boolean =>
    nodes.some(
      (node) =>
        (node.type !== "paragraph" && node.type !== "text") || !!node.marks?.length || formatted(node.content ?? []),
    );
  if (!formatted(blocks)) return false;
  event.preventDefault();
  // One paragraph goes in inline, so pasting `**bold**` mid-sentence does not split the paragraph.
  const only = blocks.length === 1 && blocks[0]!.type === "paragraph" ? blocks[0]!.content : undefined;
  editor.commands.insertContent(only ?? blocks);
  return true;
}

export type RichTextChange = {
  /** True also for only spaces or empty list items. */
  empty: boolean;
  /** An edit without focus (a checkbox click) will not be followed by a blur. */
  focused: boolean;
};

export type RichTextProps = {
  /** Markdown. A new value is shown unless the member is editing, or has edits the caller has not taken yet. */
  value: string;
  editable?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  /** Called with the Markdown after each edit by the member, never for a new `value`. */
  onChange?(markdown: string, change: RichTextChange): void;
  onBlur?(): void;
  /** ⌘Enter / Ctrl+Enter. */
  onSubmit?(): void;
  autoFocus?: boolean;
  className?: string;
  /** With it, images of these files are shown, and with its `attach` pasted and dropped files are taken. */
  files?: RichTextFiles;
  /** Who the text can mention: `@` suggests them, and a mention shows its person's name as it is now. */
  people?: readonly MentionPerson[];
};

const NOBODY: readonly MentionPerson[] = [];

function RichText({
  value,
  editable = true,
  placeholder = "",
  "aria-label": label,
  onChange,
  onBlur,
  onSubmit,
  autoFocus = false,
  className,
  files,
  people = NOBODY,
}: RichTextProps) {
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [mention, setMention] = useState<MentionState | null>(null);
  const names = useMemo(() => new Map(people.map((person) => [person.id, person.name])), [people]);
  const mentions = useRef({ people, names });
  mentions.current = { people, names };
  const [linking, setLinking] = useState(false);
  const [focused, setFocused] = useState(false);
  // The editor is created once, so it reads the latest callbacks through this.
  const props = useRef({ onChange, onBlur, onSubmit, placeholder, files });
  props.current = { onChange, onBlur, onSubmit, placeholder, files };
  const owns = (url: string) => props.current.files?.owns(url) ?? false;
  const linkable = (url: string) => isSafeUrl(url) || owns(url);
  // The Markdown last received or emitted, and whether it holds edits the caller has not echoed.
  const shown = useRef(normalizeMarkdown(value));
  const shownEmpty = useRef(!value.trim());
  const dirty = useRef(false);
  const previous = useRef(value);
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    editable,
    autofocus: autoFocus ? "end" : false,
    content: value,
    contentType: "markdown",
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        codeBlock: false,
        link: {
          openOnClick: true,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          protocols: ["mailto"],
          isAllowedUri: linkable,
          HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
        },
      }),
      refusedLinks(linkable),
      CodeBlockLowlight.configure({ lowlight }),
      fileImage(owns),
      TaskList,
      TaskItem.configure({
        nested: true,
        a11y: { checkboxLabel: (node) => node.firstChild?.textContent || "To-do item" },
      }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: () => props.current.placeholder, showOnlyWhenEditable: false }),
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      slashCommands(setSlash),
      mentionNode(() => mentions.current.names),
      mentionSuggestions(() => mentions.current.people, setMention),
      Extension.create({
        name: "richTextKeys",
        // Ahead of the hard break's own Mod-Enter.
        priority: 1000,
        addKeyboardShortcuts: () => ({
          // Never a line break (Shift+Enter is); the key still reaches a surrounding form's own handler.
          "Mod-Enter": () => {
            props.current.onSubmit?.();
            return true;
          },
        }),
      }),
    ],
    editorProps: {
      attributes: {
        class: "rich-text outline-none",
        role: "textbox",
        "aria-multiline": "true",
        ...(label ? { "aria-label": label } : {}),
      },
      handlePaste: (_view: EditorView, event: ClipboardEvent) => {
        const e = editorRef.current;
        if (!e) return false;
        // A copied file or screenshot has no text; text copied from a document may come with a picture of itself.
        const clipboard = event.clipboardData;
        if (!clipboard?.getData("text/plain") && insertFiles(e, props.current.files, clipboard?.files)) {
          event.preventDefault();
          return true;
        }
        return pasteMarkdown(e, event);
      },
      handleDrop: (view: EditorView, event: DragEvent, _slice: unknown, moved: boolean) => {
        const e = editorRef.current;
        if (!e || moved || !props.current.files?.attach || !event.dataTransfer?.files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (at) e.commands.setTextSelection(at.pos);
        return insertFiles(e, props.current.files, event.dataTransfer.files);
      },
    },
    onUpdate: ({ editor: e }) => {
      const markdown = normalizeMarkdown(e.getMarkdown());
      // `-` typed, then a space: the text becomes an empty list with the same Markdown.
      const empty = !e.state.doc.textContent.trim();
      if (markdown === shown.current && empty === shownEmpty.current) return;
      shown.current = markdown;
      shownEmpty.current = empty;
      dirty.current = true;
      props.current.onChange?.(markdown, { empty, focused: e.isFocused });
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      props.current.onBlur?.();
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    editor?.setEditable(editable, false);
    editor?.view.dom.setAttribute("aria-readonly", String(!editable));
  }, [editor, editable]);

  useEffect(() => {
    if (editor) showMentionNames(editor.view.dom, names);
  }, [editor, names]);

  // A new value never replaces the member's typing, nor edits the caller has yet to echo back.
  useEffect(() => {
    if (!editor) return;
    const next = normalizeMarkdown(value);
    const changed = value !== previous.current;
    previous.current = value;
    if (next === shown.current) {
      dirty.current = false;
      return;
    }
    if (focused || (dirty.current && !changed)) return;
    dirty.current = false;
    shown.current = next;
    editor
      .chain()
      .command(({ tr }) => {
        // Someone else's text is not the member's to undo.
        tr.setMeta("addToHistory", false);
        return true;
      })
      .setContent(value, { contentType: "markdown", emitUpdate: false })
      .run();
    shownEmpty.current = !editor.state.doc.textContent.trim();
  }, [editor, value, focused]);

  return (
    <div className={cn("relative", className)}>
      <EditorContent editor={editor} />
      {editor && editable && <SelectionToolbar editor={editor} linking={linking} setLinking={setLinking} />}
      {slash && <SlashMenu state={slash} />}
      {mention && <MentionMenu state={mention} />}
    </div>
  );
}

export { RichText };
