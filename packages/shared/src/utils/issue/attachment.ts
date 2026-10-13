import { FILE_NAME_UNSAFE, IMAGE_TYPES } from "../../constants";

/** Where a workspace's file is uploaded to and downloaded from, as rich text stores it: a path, whatever the host. */
export const attachmentPath = (workspaceId: string, id: string): string => `/api/w/${workspaceId}/files/${id}`;

/** Whether `url` is the address of a file of this workspace, and nothing more: no host, query or other path. */
export function isAttachmentPath(workspaceId: string, url: string): boolean {
  const prefix = attachmentPath(workspaceId, "");
  return url.startsWith(prefix) && /^[0-9a-f-]{36}$/i.test(url.slice(prefix.length));
}

/** The content type of a file shown as an image, by its name; undefined for every other file. */
export function imageType(name: string): string | undefined {
  const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return extension && Object.hasOwn(IMAGE_TYPES, extension) ? IMAGE_TYPES[extension] : undefined;
}

/** The name a file is attached under: its own, without what `FILE_NAME_UNSAFE` names, and never empty. */
export function fileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  return base.replace(new RegExp(FILE_NAME_UNSAFE, "gu"), "").trim() || "file";
}
