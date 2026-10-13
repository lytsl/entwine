/** Better Auth enforces it on the server. */
export const PASSWORD_MIN_LENGTH = 8;

/** The app sends a 256-pixel square, far below it. */
export const AVATAR_MAX_BYTES = 512 * 1024;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
