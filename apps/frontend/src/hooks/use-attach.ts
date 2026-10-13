import { useWorkspace } from "@entwine/db-collection/react";
import { ATTACHMENT_MAX_BYTES, attachmentPath, fileName, imageType } from "@entwine/shared";
import { toast } from "@entwine/ui/components/ui/toast";
import { useCallback } from "react";
import { formatBytes } from "../lib/files";
import { uploadFile } from "../services/files";
import { useStore } from "./use-store";

export type Attached = { name: string; url: string; image: boolean };

/** An upload that takes longer than this says so; a quicker one would only flash. */
const SLOW_MS = 400;

/**
 * Attaches a file to the issue: its bytes go to the server first, and the attachment is recorded once they are
 * there. Answers once the server has both. Null, with the reason shown, when the file is not attached.
 */
export function useAttach(issueId: string): (file: File) => Promise<Attached | null> {
  const { workspaceId } = useWorkspace();
  const { attachments } = useStore();
  return useCallback(
    async (file) => {
      const refuse = (message: string) => {
        toast.error(message);
        return null;
      };
      const name = fileName(file.name);
      if (!file.size) return refuse(`${name} is empty`);
      if (file.size > ATTACHMENT_MAX_BYTES)
        return refuse(`${name} is too large: a file is at most ${formatBytes(ATTACHMENT_MAX_BYTES)}`);
      const id = crypto.randomUUID();
      let uploading: string | undefined;
      const slow = setTimeout(() => {
        uploading = toast.loading(`Uploading ${name}…`);
      }, SLOW_MS);
      try {
        const upload = await uploadFile(workspaceId, id, file);
        if (!upload.ok)
          return refuse(upload.reason === "offline" ? "Files can only be attached while online" : upload.message);
        // Awaited: the file's address answers only once the server has the row, and the text is about to show it.
        // A refusal is shown as every refused edit is.
        const recorded = await attachments.create(issueId, id, name, file.size).then(
          () => true,
          () => false,
        );
        if (!recorded) return null;
      } finally {
        clearTimeout(slow);
        if (uploading) toast.close(uploading);
      }
      return { name, url: attachmentPath(workspaceId, id), image: imageType(name) !== undefined };
    },
    [workspaceId, attachments, issueId],
  );
}
