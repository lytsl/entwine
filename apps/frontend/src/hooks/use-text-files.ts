import { useWorkspace } from "@entwine/db-collection/react";
import { isAttachmentPath } from "@entwine/shared";
import type { RichTextFiles } from "@entwine/ui/lib/rich-text-files";
import { useMemo } from "react";
import { useAttach } from "./use-attach";

/**
 * What an issue's description and comments give their editor: the workspace's files are theirs to show, and unless
 * the text is `readOnly`, a pasted or dropped file is attached to the issue.
 */
export function useTextFiles(issueId: string, readOnly = false): RichTextFiles {
  const { workspaceId } = useWorkspace();
  const attach = useAttach(issueId);
  return useMemo(
    () => ({
      owns: (url: string) => isAttachmentPath(workspaceId, url),
      ...(readOnly ? {} : { attach }),
    }),
    [workspaceId, attach, readOnly],
  );
}
