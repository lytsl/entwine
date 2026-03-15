import { WebSocketClient } from "@/lib/sync/ws-client";
import { env } from "../../env";
import ky from "ky";

export const api = ky.create({ prefixUrl: env.VITE_SERVER_URL });

const wsClient = new WebSocket(`${env.VITE_SERVER_URL}/ws`);
export const wsSyncClient = new WebSocketClient({ ws: wsClient });
