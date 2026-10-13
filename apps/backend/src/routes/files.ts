import { ATTACHMENT_MAX_BYTES, attachmentRow, imageType, type Row } from "@entwine/shared";
import { errorResponse } from "@entwine/sync-engine";
import { Hono } from "hono";
import { maxBody } from "../middleware/body-limit";
import { ORPHAN_MS, workspaceFiles } from "../services/files";
import type { AppEnv } from "../types";

/** The header's extended form (RFC 5987), which leaves `'`, `(`, `)` and `*` to mean something else. */
const encodeName = (name: string) =>
  encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * A workspace's attachment bytes, mounted under the workspace's routes, which have checked the session, the
 * membership and the origin. The `Attachment` row is written afterwards, through the write rules.
 */
export function fileRoutes(fileDir: string) {
  const routes = new Hono<AppEnv>();
  const notFound = () => errorResponse(404, "not_found", "The file was not found");

  routes.post("/:id", maxBody(ATTACHMENT_MAX_BYTES), async (c) => {
    // Only this type: a cross-site form cannot send it.
    if (c.req.header("Content-Type")?.split(";")[0].trim() !== "application/octet-stream")
      return errorResponse(415, "invalid", "A file is sent as application/octet-stream");
    const id = attachmentRow.shape.id.safeParse(c.req.param("id"));
    if (!id.success) return errorResponse(400, "invalid", "A file's id is a UUID");
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (!bytes.length) return errorResponse(400, "invalid", "The file is empty");
    const { tenant, userId } = c.var;
    const files = workspaceFiles(fileDir, tenant.id);
    // In the tenant's queue: a deleted workspace refuses before a byte is stored, so its directory is not made again,
    // and no attachment is recorded or restored between reading the rows and deleting.
    const { result: saved } = await tenant.write(async (writer) => {
      if (!(await files.save(id.data, bytes, userId))) return false;
      const kept = new Set((await writer.list("Attachment")).map((row) => row.id));
      await files.sweep(kept, Date.now() - ORPHAN_MS);
      return true;
    });
    if (!saved) return errorResponse(409, "conflict", "A file with this id exists");
    return c.json({ size: bytes.length }, 201);
  });

  routes.get("/:id", async (c) => {
    const id = attachmentRow.shape.id.safeParse(c.req.param("id"));
    if (!id.success) return notFound();
    const { tenant } = c.var;
    const { rows } = await tenant.load([{ model: "Attachment", where: { id: id.data } }]);
    const row = rows.Attachment?.[0] as Row<"Attachment"> | undefined;
    const file = Bun.file(workspaceFiles(fileDir, tenant.id).path(id.data));
    if (!row || !(await file.exists())) return notFound();
    // These are a member's bytes on the app's origin: only raster images get a type a browser shows, everything
    // else is a download, and nothing may script or load.
    const type = imageType(row.name);
    return new Response(file, {
      headers: {
        "Content-Type": type ?? "application/octet-stream",
        "Content-Disposition": `${type ? "inline" : "attachment"}; filename*=UTF-8''${encodeName(row.name)}`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, max-age=300",
      },
    });
  });

  return routes;
}
