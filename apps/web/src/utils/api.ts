import ky from "ky";
import { WebSocketClient } from "@/lib/sync/ws-client";
import { env } from "../../env";

export const api = ky.create({
  prefixUrl: env.VITE_SERVER_URL,
  credentials: "include",
  headers: {
    "x-organization-slug": sessionStorage.getItem("orgSlug") || undefined,
  },
});

const wsClient = new WebSocket(`${env.VITE_SERVER_URL}/ws`);
export const wsSyncClient = new WebSocketClient({ ws: wsClient });
