/**
 * People's pictures, on the server's disk beside the auth database: `<uuid>.<extension>`, a new name for each upload,
 * so a browser may keep one for good. An account's `image` is the address the app serves it at.
 */
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { AVATAR_TYPES } from "@entwine/shared";

type AvatarType = (typeof AVATAR_TYPES)[number];

const EXTENSIONS: Record<AvatarType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const NAME = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;
export const AVATAR_PATH = "/api/avatars/";

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));

/** The type the bytes begin as, whatever the client said they are. */
function sniff(bytes: Uint8Array): AvatarType | null {
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG" && ascii(bytes, 4, 8) === "\r\n\x1a\n") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function avatarStore(dir: string) {
  const nameOf = (image: string | null | undefined) => {
    const name = image?.startsWith(AVATAR_PATH) ? image.slice(AVATAR_PATH.length) : null;
    return name && NAME.test(name) ? name : null;
  };
  return {
    /** The new avatar's address, or null when the bytes are not of the type they claim. */
    async save(bytes: Uint8Array, type: string): Promise<string | null> {
      const sniffed = sniff(bytes);
      if (!sniffed || sniffed !== type) return null;
      const name = `${crypto.randomUUID()}.${EXTENSIONS[sniffed]}`;
      await mkdir(dir, { recursive: true });
      await Bun.write(join(dir, name), bytes);
      return `${AVATAR_PATH}${name}`;
    },
    /** The file of a name the app serves, or null for any other name. */
    file(name: string) {
      return NAME.test(name) ? Bun.file(join(dir, name)) : null;
    },
    /** Deletes the file an `image` names, when it is one of these. */
    async remove(image: string | null | undefined) {
      const name = nameOf(image);
      if (name) await rm(join(dir, name), { force: true });
    },
  };
}

export type AvatarStore = ReturnType<typeof avatarStore>;
