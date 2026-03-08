import { reqStorage, syncEvents } from "@/utils/sync-utlity";

export const createDrizzleExtension = <T>(drizzle: T): T => {
	const { session } = drizzle as any;
	const proto = Object.getPrototypeOf(session);

	proto.prepareQuery = new Proxy(proto.prepareQuery, {
		apply(target, thisArg, args) {
			if (["insert", "update", "delete"].includes(args[5]?.type)) {
				const reqContext = reqStorage.getStore();
				syncEvents.emit("mutations", {
					...args[5],
					...reqContext,
				});
			}

			return Reflect.apply(target, thisArg, args);
		},
	});

	return drizzle;
};
