/** A client can name the row before the server confirms it, and making the same pair twice is a conflict. */
export const pairId = (first: string, second: string): string => `${first}:${second}`;

/** One reaction per member, emoji and target: the comment reacted to, or the issue itself. */
export const reactionId = (targetId: string, userId: string, emoji: string): string =>
  pairId(pairId(targetId, userId), emoji);

/** The two issues are sorted, which allows one relation per pair whatever its direction. */
export const issueRelationId = (a: string, b: string): string => (a < b ? pairId(a, b) : pairId(b, a));
