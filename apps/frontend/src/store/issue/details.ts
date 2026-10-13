/**
 * The edits of an issue's relations, links, comments, reactions and attachments. Its page reads the rows with a live query, which loads them
 * when it asks.
 */

import type { Workspace } from "@entwine/db-collection/react";
import { attachmentPath, issueRelationId, type ReactionEmoji, type RelationType, reactionId } from "@entwine/shared";
import type { Attachment, IssueLink } from "../../types/rows";

export class Relations {
  constructor(private readonly ws: Workspace) {}

  /** `blocks` reads "issueId blocks relatedId". */
  create = (issueId: string, relatedId: string, type: RelationType) =>
    this.ws.mutate(() =>
      this.ws.collections.IssueRelation.insert({
        id: issueRelationId(issueId, relatedId),
        issueId,
        relatedId,
        type,
        createdAt: Date.now(),
      }),
    );

  delete = (id: string) => this.ws.mutate(() => this.ws.collections.IssueRelation.delete(id));
}

export class Links {
  constructor(private readonly ws: Workspace) {}

  create = (issueId: string, url: string, title: string) =>
    this.ws.mutate(() =>
      this.ws.collections.IssueLink.insert({
        id: crypto.randomUUID(),
        issueId,
        url: url.trim(),
        title: title.trim(),
        creatorId: this.ws.userId,
        createdAt: Date.now(),
      }),
    );

  update = (id: string, patch: Pick<IssueLink, "url" | "title">) =>
    this.ws.mutate(() =>
      this.ws.collections.IssueLink.update(id, (link) =>
        Object.assign(link, { url: patch.url.trim(), title: patch.title.trim() }),
      ),
    );

  delete = (id: string) => this.ws.mutate(() => this.ws.collections.IssueLink.delete(id));
}

export class Comments {
  constructor(private readonly ws: Workspace) {}

  create = (issueId: string, body: string) => {
    const now = Date.now();
    return this.ws.mutate(() =>
      this.ws.collections.Comment.insert({
        id: crypto.randomUUID(),
        issueId,
        authorId: this.ws.userId,
        body: body.trim(),
        createdAt: now,
        updatedAt: now,
        editedAt: null,
      }),
    );
  };

  update = (id: string, body: string) =>
    this.ws.mutate(() =>
      this.ws.collections.Comment.update(id, (comment) => {
        comment.body = body.trim();
        comment.editedAt = Date.now();
      }),
    );

  delete = (id: string) => this.ws.mutate(() => this.ws.collections.Comment.delete(id));
}

export class Reactions {
  constructor(private readonly ws: Workspace) {}

  /** The member's own reaction to the comment, or to the issue when `commentId` is null: made, or taken back. */
  toggle = (issueId: string, commentId: string | null, emoji: ReactionEmoji) => {
    const { Reaction } = this.ws.collections;
    const id = reactionId(commentId ?? issueId, this.ws.userId, emoji);
    return this.ws.mutate(() => {
      if (Reaction.has(id)) Reaction.delete(id);
      else Reaction.insert({ id, issueId, commentId, userId: this.ws.userId, emoji, createdAt: Date.now() });
    });
  };
}

export class Attachments {
  constructor(private readonly ws: Workspace) {}

  /** `id` is the one the file's bytes were uploaded under, which the server needs to have first. */
  create = (issueId: string, id: string, name: string, size: number) =>
    this.ws.mutate(() =>
      this.ws.collections.Attachment.insert({
        id,
        issueId,
        name: name.trim(),
        size,
        uploaderId: this.ws.userId,
        createdAt: Date.now(),
      }),
    );

  delete = (id: string) => this.ws.mutate(() => this.ws.collections.Attachment.delete(id));

  /**
   * Whether the issue's description or one of its comments shows the file. Removing the attachment leaves that
   * text as it is, so the member is asked first. Read when asked, from the comments the issue's page has loaded.
   */
  inText = (attachment: Attachment): boolean => {
    const { Issue, Comment } = this.ws.collections;
    const path = attachmentPath(this.ws.workspaceId, attachment.id);
    if (Issue.get(attachment.issueId)?.description.includes(path)) return true;
    for (const comment of Comment.values())
      if (comment.issueId === attachment.issueId && comment.body.includes(path)) return true;
    return false;
  };
}
