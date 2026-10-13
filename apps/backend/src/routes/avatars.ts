import { AVATAR_MAX_BYTES, AVATAR_TYPES } from "@entwine/shared";
import { errorResponse } from "@entwine/sync-engine";
import { type Context, Hono } from "hono";
import type { Auth } from "../auth/create-auth";
import { maxBody } from "../middleware/body-limit";
import { sameOrigin } from "../middleware/same-origin";
import type { AvatarStore } from "../services/avatars";
import type { AppEnv } from "../types";

/** Mounted at `/api`: an account's picture is uploaded to `/avatar` and served from `/avatars/<name>`. */
export function avatarRoutes(auth: Auth, avatars: AvatarStore, origin: string) {
  const routes = new Hono<AppEnv>();
  const session = (c: Context) => auth.auth.api.getSession({ headers: c.req.raw.headers });
  const unauthenticated = () => errorResponse(401, "unauthenticated", "Sign in to continue");
  /** Not through `/update-user`, which refuses an `image`; the user's update hooks still carry it to every workspace. */
  const setImage = async (userId: string, image: string | null) =>
    (await auth.auth.$context).internalAdapter.updateUser(userId, { image });

  routes.on(["PUT", "DELETE"], "/avatar", sameOrigin(origin));

  routes.put("/avatar", maxBody(AVATAR_MAX_BYTES), async (c) => {
    const signedIn = await session(c);
    if (!signedIn) return unauthenticated();
    const type = c.req.header("Content-Type")?.split(";")[0].trim() ?? "";
    if (!(AVATAR_TYPES as readonly string[]).includes(type))
      return errorResponse(415, "invalid", "A picture is a PNG, JPEG or WebP image");
    const image = await avatars.save(new Uint8Array(await c.req.arrayBuffer()), type);
    if (!image) return errorResponse(400, "invalid", "The file is not the image it says it is");
    await setImage(signedIn.user.id, image);
    await avatars.remove(signedIn.user.image);
    return c.json({ image });
  });

  routes.delete("/avatar", async (c) => {
    const signedIn = await session(c);
    if (!signedIn) return unauthenticated();
    await setImage(signedIn.user.id, null);
    await avatars.remove(signedIn.user.image);
    return c.json({ image: null });
  });

  routes.get("/avatars/:name", async (c) => {
    if (!(await session(c))) return unauthenticated();
    const file = avatars.file(c.req.param("name"));
    if (!file || !(await file.exists())) return errorResponse(404, "not_found", "The picture was not found");
    // A new upload gets a new name, so this one never changes. Its bytes were checked, and may not script.
    return new Response(file, {
      headers: {
        "Content-Type": file.type,
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });

  return routes;
}
