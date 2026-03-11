import { Hono } from "hono";
import type { THonoPrivateEnv } from "@/routes/types";
import { authGuard } from "./auth.guard";

export function createPrivateApp() {
	return new Hono<THonoPrivateEnv>().use("*", authGuard);
}
