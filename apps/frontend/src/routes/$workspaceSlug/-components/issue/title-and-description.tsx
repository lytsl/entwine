import { RichText } from "@entwine/ui/components/editor/rich-text";
import { normalizeMarkdown } from "@entwine/ui/lib/markdown";
import { cn } from "@entwine/ui/lib/utils";
import { useCallback, useEffect, useRef } from "react";
import { useDraft } from "../../../../hooks/use-draft";
import { useStore } from "../../../../hooks/use-store";
import { useTextFiles } from "../../../../hooks/use-text-files";
import { type Issue } from "../../../../types/rows";

/**
 * The description saves when the editor loses focus or the issue closes, not while typing: each save is one undo step
 * and one activity entry. An edit made without focus (a to-do checkbox) saves at once, since no blur will follow.
 */
function Description({ issue, readOnly }: { issue: Issue; readOnly: boolean }) {
  const { issues, members } = useStore();
  const files = useTextFiles(issue.id, readOnly);
  const unsaved = useRef<string | null>(null);
  const latest = useRef(issue);
  latest.current = issue;
  const save = useCallback(() => {
    const description = unsaved.current;
    unsaved.current = null;
    const issue = latest.current;
    if (description !== null && description !== normalizeMarkdown(issue.description))
      void issues.update(issue.id, { description });
  }, [issues]);
  useEffect(() => save, [save]);
  return (
    <RichText
      aria-label="Description"
      value={issue.description}
      people={members.people}
      editable={!readOnly}
      files={files}
      placeholder={readOnly ? "No description" : "Add a description…"}
      className={cn(
        "-mx-2 rounded-md px-2 py-1.5 [&_.tiptap]:min-h-21",
        !readOnly && "hover:bg-accent/30 has-focus:bg-transparent",
      )}
      onChange={(markdown, { focused }) => {
        unsaved.current = markdown;
        if (!focused) save();
      }}
      onBlur={save}
    />
  );
}

export function TitleAndDescription({ issue, readOnly }: { issue: Issue; readOnly: boolean }) {
  const store = useStore();
  const [title, setTitle] = useDraft(issue.title);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Title"
        readOnly={readOnly}
        rows={1}
        className="field-sizing-content -mx-2 resize-none rounded-md bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight outline-none hover:bg-accent/40 focus:bg-transparent"
        value={title}
        onChange={(event) => setTitle(event.target.value.replace(/\n/g, ""))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onBlur={() => {
          if (!title.trim()) setTitle(issue.title);
          else if (title.trim() !== issue.title) void store.issues.update(issue.id, { title: title.trim() });
        }}
      />
      <Description issue={issue} readOnly={readOnly} />
    </div>
  );
}
