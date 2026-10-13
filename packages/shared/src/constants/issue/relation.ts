/** `blocks` reads "issueId blocks relatedId"; the other types are symmetric. */
export const RELATION_TYPES = ["blocks", "relates_to", "duplicate"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

/** How a relation reads from one of its issues. */
export const RELATION_SIDES = ["blocks", "blocked_by", "relates_to", "duplicate"] as const;
export type RelationSide = (typeof RELATION_SIDES)[number];
