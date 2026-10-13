import { useWorkspace } from "@entwine/db-collection/react";
import { attachmentPath, imageType } from "@entwine/shared";
import { Button } from "@entwine/ui/components/ui/button";
import { ConfirmDialog } from "@entwine/ui/components/ui/confirm-dialog";
import { UserAvatar } from "@entwine/ui/components/ui/user-avatar";
import { FileIcon, ImageIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { timeAgo } from "../../../../../lib/dates";
import { formatBytes } from "../../../../../lib/files";
import type { Store } from "../../../../../store";
import type { Attachment } from "../../../../../types/rows";
import { WidgetSection } from "./widget-section";

export function Attachments({ store, attachments, onAdd }: { store: Store; attachments: Attachment[]; onAdd(): void }) {
  const ws = useWorkspace();
  const sorted = [...attachments].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const admin = store.members.isAdmin();
  // An attachment the issue's text shows, which the member is asked about before it goes.
  const [removing, setRemoving] = useState<Attachment | null>(null);
  return (
    <WidgetSection
      title="Attachments"
      addLabel="Attach file"
      onAdd={onAdd}
      extra={<span className="text-caption text-muted-foreground">{attachments.length}</span>}
    >
      <ul className="flex flex-col gap-1" aria-label="Attachments">
        {sorted.map((attachment) => {
          const uploader = store.members.get(attachment.uploaderId);
          return (
            <li
              key={attachment.id}
              className="group/line flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2 hover:bg-accent/40"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
                {imageType(attachment.name) ? <ImageIcon /> : <FileIcon />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <a
                  href={attachmentPath(ws.workspaceId, attachment.id)}
                  download={attachment.name}
                  className="truncate text-body font-medium hover:underline"
                >
                  {attachment.name}
                </a>
                <span className="flex items-center gap-1 truncate text-caption text-muted-foreground">
                  {formatBytes(attachment.size)} · added {timeAgo(attachment.createdAt)} by{" "}
                  <UserAvatar user={uploader} size={14} />
                  {uploader?.name ?? "someone"}
                </span>
              </div>
              {(admin || attachment.uploaderId === ws.userId) && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="hover-reveal group-hover/line:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove attachment ${attachment.name}`}
                  onClick={() =>
                    store.attachments.inText(attachment)
                      ? setRemoving(attachment)
                      : void store.attachments.delete(attachment.id)
                  }
                >
                  <XIcon />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          description="The description or a comment of this issue shows this file. Its name stays in that text, but the file can no longer be opened from it."
          confirmLabel="Remove"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            void store.attachments.delete(removing.id);
            setRemoving(null);
          }}
        />
      )}
    </WidgetSection>
  );
}
