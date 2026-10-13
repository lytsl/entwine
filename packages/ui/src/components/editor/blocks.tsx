import type { Editor, Range } from "@tiptap/core";
import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  type LucideIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
  SquareCodeIcon,
  Table2Icon,
} from "lucide-react";

export type Block = {
  label: string;
  icon: LucideIcon;
  /** Words it is found by, besides its label. */
  keywords: string;
  run(editor: Editor, range: Range): void;
};

const BLOCKS: Block[] = [
  {
    label: "Text",
    icon: PilcrowIcon,
    keywords: "paragraph plain",
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  ...([1, 2, 3] as const).map(
    (level): Block => ({
      label: `Heading ${level}`,
      icon: [Heading1Icon, Heading2Icon, Heading3Icon][level - 1]!,
      keywords: `title h${level}`,
      run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level }).run(),
    }),
  ),
  {
    label: "Bulleted list",
    icon: ListIcon,
    keywords: "unordered bullet",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    label: "Numbered list",
    icon: ListOrderedIcon,
    keywords: "ordered",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    label: "To-do list",
    icon: ListTodoIcon,
    keywords: "todo task checklist checkbox",
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    label: "Quote",
    icon: QuoteIcon,
    keywords: "blockquote",
    run: (e, r) => e.chain().focus().deleteRange(r).setBlockquote().run(),
  },
  {
    label: "Code block",
    icon: SquareCodeIcon,
    keywords: "snippet fence",
    run: (e, r) => e.chain().focus().deleteRange(r).setCodeBlock().run(),
  },
  {
    label: "Table",
    icon: Table2Icon,
    keywords: "grid",
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    label: "Divider",
    icon: MinusIcon,
    keywords: "horizontal rule separator hr",
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
];

export function findBlocks(query: string): Block[] {
  const q = query.trim().toLowerCase();
  return q ? BLOCKS.filter((block) => `${block.label} ${block.keywords}`.toLowerCase().includes(q)) : BLOCKS;
}
