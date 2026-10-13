import { expect, test } from "bun:test";
import { attachmentPath, fileName, imageType, isAttachmentPath, rowSchemas } from "../../../src";

const ID = "0b9c1c1e-7d0a-4a8e-9c53-1f2f1f6f2a10";

test("a file's address is a path of its workspace, and nothing else is one", () => {
  const path = attachmentPath("w1", ID);
  expect(path).toBe(`/api/w/w1/files/${ID}`);
  expect(isAttachmentPath("w1", path)).toBe(true);
  for (const other of [
    attachmentPath("w2", ID),
    `https://example.com${path}`,
    `${path}?x=1`,
    `${path}/../../load`,
    "/api/w/w1/files/../../../auth/sign-out",
    "javascript:alert(1)",
  ])
    expect(isAttachmentPath("w1", other)).toBe(false);
});

test("only raster images are images: SVG and HTML are downloads", () => {
  expect(imageType("Shot.PNG")).toBe("image/png");
  expect(imageType("photo.jpeg")).toBe("image/jpeg");
  for (const name of ["logo.svg", "page.html", "png", "archive.png.zip", "constructor"])
    expect(imageType(name)).toBeUndefined();
});

test("an attachment's id is a UUID, and a reaction's emoji is one of the set", () => {
  const attachment = { id: ID, issueId: "i", name: "a.txt", size: 1, uploaderId: "u", createdAt: 0 };
  expect(rowSchemas.Attachment.safeParse(attachment).success).toBe(true);
  expect(rowSchemas.Attachment.safeParse({ ...attachment, id: "../auth.db" }).success).toBe(false);
  expect(rowSchemas.Attachment.safeParse({ ...attachment, id: ID.toUpperCase() }).success).toBe(false);
  const reaction = { id: "i:u:👍", issueId: "i", commentId: null, userId: "u", emoji: "👍", createdAt: 0 };
  expect(rowSchemas.Reaction.safeParse(reaction).success).toBe(true);
  expect(rowSchemas.Reaction.safeParse({ ...reaction, emoji: "💩" }).success).toBe(false);
});

test("a file's name has no directory, control characters or direction marks, and the schema refuses one that has", () => {
  const named = (name: string) => rowSchemas.Attachment.shape.name.safeParse(name).success;
  for (const [given, kept] of [
    ["notes.txt", "notes.txt"],
    ["  Résumé 👩‍💻 (final).pdf ", "Résumé 👩‍💻 (final).pdf"],
    ["C:\\Users\\ada\\shot.png", "shot.png"],
    ["../../etc/passwd", "passwd"],
    ["a\r\nb\u0000.txt", "ab.txt"],
    ["photo\u202egnp.exe", "photognp.exe"],
    ["\u202e/", "file"],
    ["", "file"],
  ] as const) {
    expect(fileName(given)).toBe(kept);
    expect(named(kept)).toBe(true);
    if (given.trim() !== kept) expect(named(given)).toBe(false);
  }
});
