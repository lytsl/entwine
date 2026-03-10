import { orgWsClientMap } from "@/routes/ws";
import { reqStorage } from "@/utils/sync-utlity";

export const createDrizzleExtension = <T>(drizzle: T): T => {
	const { session } = drizzle as any;
	const proto = Object.getPrototypeOf(session);

	proto.prepareQuery = new Proxy(proto.prepareQuery, {
		apply(target, thisArg, args) {
			if (["insert", "update", "delete"].includes(args[5]?.type)) {
				const reqContext = reqStorage.getStore();
				const clients = orgWsClientMap.get("org");
				for (const arg of args) console.log(arg);
				const data = JSON.stringify({
					cmd: "sync",
					sync: [],
					lastSyncId: Date.now(),
				});
				console.log(clients);
				if (clients)
					for (const client of clients) {
						client.send(data);
					}
				// syncEvents.emit("mutations", {
				// 	...args[5],
				// 	...reqContext,
				// });
			}

			return Reflect.apply(target, thisArg, args);
		},
	});

	return drizzle;
};
