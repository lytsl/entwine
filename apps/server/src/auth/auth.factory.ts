import { Hono } from "hono";
import { authGuard } from "./auth.guard";
import type { BetterAuthSession } from "./better-auth";

export function createPrivateApp() {
	return new Hono<{ Variables: BetterAuthSession }>().use("*", authGuard);
}
