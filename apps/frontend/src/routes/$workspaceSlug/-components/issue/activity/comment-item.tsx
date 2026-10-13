import { useWorkspace } from "@entwine/db-collection/react";
import type { Row } from "@entwine/shared";
import { RichText } from "@entwine/ui/components/editor/rich-text";
import { Button } from "@entwine/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@entwine/ui/components/ui/dropdown-menu";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTextFiles } from "../../../../../hooks/use-text-files";
import type { Store } from "../../../../../store";
import type { CommentDraft } from "../../../../../types/comment";
import type { Reaction } from "../../../../../types/rows";
import { Reactions } from "../reactions/reactions";
import { When } from "./when";

export function CommentItem({
  comment,
  reactions,
  store,
  readOnly,
}: {
  comment: Row<"Comment">;
  /** The issue's reactions, this comment's among them. */
  reactions: readonly Reaction[];
  store: Store;
  readOnly: boolean;
}) {
  const ws = useWorkspace();
  const [editing, setEditing] = useState<CommentDraft | null>(null);
  const files = useTextFiles(comment.issueId, readOnly);
  const author = store.members.get(comment.authorId);
  const mine = comment.authorId === ws.userId;
  const canDelete = mine || store.members.isAdmin();
  const save = () => {
    if (!editing || editing.empty) return;
    void store.comments.update(comment.id, editing.markdown);
    setEditing(null);
  };
  return (
    <li className="relative flex gap-3 pb-5" data-testid="comment">
      <span className="absolute top-8 bottom-0 left-[13px] w-px bg-border" aria-hidden />
      <span className="z-[1] mt-0.5 flex size-7 shrink-0 items-center justify-center">
        <UserAvatar user={author} size={26} />
      </span>
      <div className="min-w-0 flex-1 rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-caption">
          <span className="min-w-0 truncate font-medium text-foreground">{author?.name ?? "Unknown"}</span>
          <When at={comment.createdAt} />
          {comment.editedAt && <span className="text-muted-foreground">(edited)</span>}
          {canDelete && editing === null && !readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-xs" className="-my-1 ml-auto" aria-label="Comment actions" />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {mine && (
                  <DropdownMenuItem onClick={() => setEditing({ markdown: comment.body, empty: false })}>
                    <PencilIcon />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onClick={() => store.comments.delete(comment.id)}>
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {editing === null ? (
          <>
            <RichText
              value={comment.body}
              people={store.members.people}
              editable={false}
              files={files}
              className="px-3 py-2.5"
            />
            <Reactions
              issueId={comment.issueId}
              commentId={comment.id}
              reactions={reactions}
              store={store}
              readOnly={readOnly}
              className="px-3 pb-2.5"
            />
          </>
        ) : (
          <div className="flex flex-col gap-2 p-2">
            <RichText
              aria-label="Edit comment"
              autoFocus
              value={editing.markdown}
              files={files}
              people={store.members.people}
              onChange={(markdown, { empty }) => setEditing({ markdown, empty })}
              onSubmit={save}
              className="px-1 py-1 [&_.tiptap]:min-h-14"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={editing.empty} onClick={save}>
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
