/** The emoji a member can react with, in the order they are offered. A reaction stores the character. */
export const REACTIONS = ["👍", "👎", "😄", "🎉", "❤️", "👀"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];
