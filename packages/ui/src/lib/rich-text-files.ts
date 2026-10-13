/** The files of whatever a rich text belongs to. The editor knows only their addresses. */
export type RichTextFiles = {
  /** Whether an address is one of those files: only such an image is loaded, and a link may point to one. */
  owns(url: string): boolean;
  /** Stores a pasted or dropped file and answers what to put in the text; null when it could not. */
  attach?(file: File): Promise<{ name: string; url: string; image: boolean } | null>;
};
