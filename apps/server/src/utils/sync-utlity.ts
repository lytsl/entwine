import { AsyncLocalStorage } from "node:async_hooks";
import EventEmitter from "node:events";

export const syncEvents = new EventEmitter();
export const reqStorage = new AsyncLocalStorage<{ sessionId: string }>();

syncEvents.addListener("mutations", (d) => console.log(d));
