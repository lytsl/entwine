/** The most one attached file holds: the app checks before sending, and the upload's body limit is the same. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The files shown as images, and served with their own content type, by the extension of their name. Every other
 * file is a download: SVG and HTML among them, which a browser would run.
 */
export const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

/**
 * What an attachment's name never holds: a directory, control characters, or the marks that change the direction
 * of text, with which `gnp.exe` reads as `exe.png`. The name is shown to other members and names their download.
 */
export const FILE_NAME_UNSAFE = /[\p{Cc}\u200e\u200f\u202a-\u202e\u2066-\u2069/\\]/u;
