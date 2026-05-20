import type { IDBPTransaction } from "idb";
import { EventBus } from "../event-bus";
import type { WsSyncData } from "./ws-client";

export const syncEventBus = new EventBus<
	Record<
		`${string}:sync`,
		{
			data: Array<WsSyncData>;
			lastSyncId?: number;
			tx?: IDBPTransaction<unknown, string[], "readwrite">;
		}
	> &
		Record<
			`${string}:markReady`,
			{
				lastSyncId: number;
			}
		> &
		Record<`${string}:syncInitiated`, unknown>
>();
