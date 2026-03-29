import type { IDBPTransaction } from "idb";
import type { IdbModelName } from "@/db";
import { EventBus } from "../event-bus";
import type { WsSyncData } from "./ws-client";

export const syncEventBus = new EventBus<
	Record<
		`${IdbModelName}:sync`,
		{
			data: Array<WsSyncData>;
			lastSyncId?: number;
			tx?: IDBPTransaction<unknown, string[], "readwrite">;
		}
	> &
		Record<
			`${IdbModelName}:markReady`,
			{
				lastSyncId: number;
			}
		>
>();
