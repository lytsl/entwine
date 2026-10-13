import { Button } from "@entwine/ui/components/ui/button";
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@entwine/ui/components/ui/toolbar";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  BetweenHorizontalEndIcon,
  BetweenHorizontalStartIcon,
  BetweenVerticalEndIcon,
  BetweenVerticalStartIcon,
  BoldIcon,
  CodeIcon,
  Grid2x2XIcon,
  HeadingIcon,
  ItalicIcon,
  Link2Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  QuoteIcon,
  SquareCodeIcon,
  StrikethroughIcon,
  TableColumnsSplitIcon,
  TableRowsSplitIcon,
} from "lucide-react";
import { type ReactNode, useLayoutEffect } from "react";
import { LinkPrompt } from "./link-prompt";

function Tool({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <ToolbarButton
      render={
        <Button variant="ghost" size="icon-sm" className="size-7 aria-pressed:bg-accent aria-pressed:text-foreground" />
      }
      aria-label={label}
      title={label}
      aria-pressed={active}
      // Keeps the selection in the editor.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </ToolbarButton>
  );
}

const TOOLBAR = "richTextToolbar";

export function SelectionToolbar({
  editor,
  linking,
  setLinking,
}: {
  editor: Editor;
  linking: boolean;
  setLinking(open: boolean): void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      empty: e.state.selection.empty,
      inTable: e.isActive("table"),
      inCode: e.isActive("codeBlock"),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      heading: e.isActive("heading"),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      taskList: e.isActive("taskList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
    }),
  });
  const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) =>
    command(editor.chain().focus()).run();
  const marks = !state.empty && !state.inCode;
  // The menu is placed before React fills it, so it is placed again once its rows, and so its height, are known.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the rows shown are what change its size.
  useLayoutEffect(() => {
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(TOOLBAR, "updatePosition"));
  }, [editor, marks, state.inTable, linking]);
  return (
    <BubbleMenu
      editor={editor}
      pluginKey={TOOLBAR}
      options={{ placement: "top", offset: 8 }}
      // With only a cursor in a table, the table menu sits above the table rather than over the cells.
      getReferencedVirtualElement={() => {
        if (!editor.state.selection.empty) return null;
        const { node } = editor.view.domAtPos(editor.state.selection.from);
        const table = (node instanceof Element ? node : node.parentElement)?.closest("table");
        return table ? { getBoundingClientRect: () => table.getBoundingClientRect() } : null;
      }}
      shouldShow={({ editor: e, state: s }) =>
        e.isEditable && (e.isActive("table") || (!s.selection.empty && !e.isActive("codeBlock")))
      }
      className="z-50 flex flex-col gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg shadow-black/10 dark:shadow-black/40"
    >
      {linking ? (
        <LinkPrompt editor={editor} initial={state.href} onDone={() => setLinking(false)} />
      ) : (
        <>
          {marks && (
            <Toolbar aria-label="Formatting">
              <Tool label="Bold" active={state.bold} onClick={() => run((c) => c.toggleBold())}>
                <BoldIcon />
              </Tool>
              <Tool label="Italic" active={state.italic} onClick={() => run((c) => c.toggleItalic())}>
                <ItalicIcon />
              </Tool>
              <Tool label="Strikethrough" active={state.strike} onClick={() => run((c) => c.toggleStrike())}>
                <StrikethroughIcon />
              </Tool>
              <Tool label="Code" active={state.code} onClick={() => run((c) => c.toggleCode())}>
                <CodeIcon />
              </Tool>
              <Tool label="Link" active={state.link} onClick={() => setLinking(true)}>
                <Link2Icon />
              </Tool>
              {!state.inTable && (
                <>
                  <ToolbarSeparator />
                  <Tool
                    label="Heading"
                    active={state.heading}
                    onClick={() => run((c) => c.toggleHeading({ level: 2 }))}
                  >
                    <HeadingIcon />
                  </Tool>
                  <Tool
                    label="Bulleted list"
                    active={state.bulletList}
                    onClick={() => run((c) => c.toggleBulletList())}
                  >
                    <ListIcon />
                  </Tool>
                  <Tool
                    label="Numbered list"
                    active={state.orderedList}
                    onClick={() => run((c) => c.toggleOrderedList())}
                  >
                    <ListOrderedIcon />
                  </Tool>
                  <Tool label="To-do list" active={state.taskList} onClick={() => run((c) => c.toggleTaskList())}>
                    <ListTodoIcon />
                  </Tool>
                  <Tool label="Quote" active={state.blockquote} onClick={() => run((c) => c.toggleBlockquote())}>
                    <QuoteIcon />
                  </Tool>
                  <Tool label="Code block" active={state.codeBlock} onClick={() => run((c) => c.toggleCodeBlock())}>
                    <SquareCodeIcon />
                  </Tool>
                </>
              )}
            </Toolbar>
          )}
          {state.inTable && (
            <Toolbar aria-label="Table">
              <Tool label="Add row above" onClick={() => run((c) => c.addRowBefore())}>
                <BetweenHorizontalStartIcon />
              </Tool>
              <Tool label="Add row below" onClick={() => run((c) => c.addRowAfter())}>
                <BetweenHorizontalEndIcon />
              </Tool>
              <Tool label="Add column left" onClick={() => run((c) => c.addColumnBefore())}>
                <BetweenVerticalStartIcon />
              </Tool>
              <Tool label="Add column right" onClick={() => run((c) => c.addColumnAfter())}>
                <BetweenVerticalEndIcon />
              </Tool>
              <ToolbarSeparator />
              <Tool label="Delete row" onClick={() => run((c) => c.deleteRow())}>
                <TableRowsSplitIcon />
              </Tool>
              <Tool label="Delete column" onClick={() => run((c) => c.deleteColumn())}>
                <TableColumnsSplitIcon />
              </Tool>
              <Tool label="Delete table" onClick={() => run((c) => c.deleteTable())}>
                <Grid2x2XIcon />
              </Tool>
            </Toolbar>
          )}
        </>
      )}
    </BubbleMenu>
  );
}
