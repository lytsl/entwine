import { useReactions } from "../../../../../hooks/use-reactions";
import type { Store } from "../../../../../store";
import { Reactions } from "./reactions";

export function IssueReactions({ issueId, store, readOnly }: { issueId: string; store: Store; readOnly: boolean }) {
  const reactions = useReactions(issueId);
  return <Reactions issueId={issueId} commentId={null} reactions={reactions} store={store} readOnly={readOnly} />;
}
