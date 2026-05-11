import type { WithOptional, WithRequired } from "@entwine/utility/types";
import {
  type CollectionConfig,
  type DeleteMutationFnParams,
  type InsertMutationFnParams,
  type SyncConfig,
  TanStackDBError,
  type UpdateMutationFnParams,
  type UtilsRecord,
} from "@tanstack/db";
import { Store } from "@tanstack/react-store";
import type { z } from "zod";
import { api } from "@/utils/api";
import type { LazyIDB } from "../idb-wrapper";
import { syncEventBus } from "./events";
import type { BulkWrite } from "./ws-client";

interface WebSocketCollectionConfig<
  TModel extends object = Record<string, unknown>,
  TModelName extends string = string,
> extends WithOptional<
  Omit<
    WithRequired<CollectionConfig<TModel, string, z.ZodType<TModel>>, "schema">,
    "onInsert" | "onUpdate" | "onDelete" | "sync" | "id"
  >,
  "getKey"
> {
  modelName: TModelName;
  db: LazyIDB;

  apiPath?: string;
}

interface WebSocketUtils<
> extends UtilsRecord {
  bulkWrite: BulkWrite;
}

export class TrailBaseDBCollectionError extends TanStackDBError {
  constructor(message: string) {
    super(message);
    this.name = "TrailBaseDBCollectionError";
  }
}

export class TimeoutWaitingForIdsError extends TrailBaseDBCollectionError {
  constructor(ids: string | number) {
    super(`Timeout waiting for ids: ${ids}`);
    this.name = "TimeoutWaitingForIdsError";
  }
}

export function webSocketCollectionOptions<
  TModel extends object = Record<string, unknown>,
  TModelName extends string = string,
>(
  config: WebSocketCollectionConfig<TModel, TModelName>,
): WithRequired<
  CollectionConfig<TModel, string, z.ZodType<TModel>>,
  "schema"
> & {
  utils: WebSocketUtils;
} {
  config.apiPath ??= `sync/cud`;
  const apiPath = config.apiPath!;
  const lastSyncId = new Store(0);
  const db = config.db;

  const awaitLastSyncId = (
    syncId: number,
    timeout: number = 120 * 1000,
  ): Promise<void> => {
    if (typeof syncId !== "number") {
      console.error("Invalid last sync id", syncId);
      return Promise.resolve();
    }
    const completed = (lastSyncId: number) => lastSyncId >= syncId;
    if (completed(lastSyncId.state)) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new TimeoutWaitingForIdsError(syncId));
      }, timeout);

      const { unsubscribe } = lastSyncId.subscribe((value) => {
        if (completed(value)) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve();
        }
      });
    });
  };

  let bulkWrite: BulkWrite;

  const sync: SyncConfig<TModel, string>["sync"] = (params) => {
    const { begin, write, commit, markReady } = params;

    db.getAll(config.modelName).then((data) => {
      begin();
      if (Array.isArray(data)) {
        for (const item of data) {
          write({ type: "insert", value: item });
        }
      }
      commit();
    });

    bulkWrite = async ({ data, ...props }) => {
      debugger;
      begin();
      const tx =
        props.tx ??
        db.transaction([config.modelName, "_metadata"], "readwrite");
      const modelStore = tx.objectStore(config.modelName);

      await Promise.all(
        [
          data.map((item) => {
            write({
              type: item.action,
              value: item.data as TModel,
            });

            switch (item.action) {
              case "insert":
                return modelStore.add(item.data);
              case "update":
                return modelStore.put(item.data);
              case "delete":
                return modelStore.delete((item.data as any).id);
              default:
                return Promise.resolve();
            }
          }),
          props.tx
            ? []
            : [
                tx.done,
                typeof props.lastSyncId === "number"
                  ? [
                      tx.objectStore("_metadata").put(
                        { lastSyncId: props.lastSyncId },
                        "syncData",
                      ),
                    ]
                  : [],
              ],
        ].flat(3),
      );

      if (typeof props.lastSyncId === "number")
        lastSyncId.setState(() => props.lastSyncId as number);
      commit();
    };

    syncEventBus.on(`${config.modelName}:sync`, {
      handle: bulkWrite,
    });

    // (db as TMetadataDb).get("_metadata", "syncData").then((syncData) => {
    //   const lastSyncIdFromDb = syncData?.lastSyncId ?? 0;
    //   if (typeof lastSyncIdFromDb === "number") {
    //     lastSyncId.setState(() => lastSyncIdFromDb);
    //   }

    //   api
    //     .get(`${config.apiPath}/delta`, {
    //       searchParams: { lastSyncId: lastSyncIdFromDb },
    //     })
    //     .json()
    //     .then(async (data) => {
    //       if (Array.isArray(data) && data.length > 0) {
    //         bulkWrite({
    //           data,
    //           lastSyncId: data.reduce((acc, item) => Math.max(acc, item.id), 0),
    //         });
    //       }
    //       markReady();
    //     });
    // });

    const handleMarkReady = (payload: { lastSyncId: number }) => {
      lastSyncId.setState(() => payload.lastSyncId);
      markReady();
    };
    syncEventBus.on(`${config.modelName}:markReady`, {
      handle: handleMarkReady,
    });

    // console.log("emit",`${config.modelName}:syncInitiated`)

    return {
      cleanup: () => {
        syncEventBus.off(`${config.modelName}:sync`, bulkWrite);
        syncEventBus.off(`${config.modelName}:markReady`, handleMarkReady);
      },
      // loadSubset: async (options: LoadSubsetOptions) => {
      //   const query = parseLoadSubsetOptions(options);

      //   const data = await db.getAll(config.modelName, undefined, query.limit);

      //   begin();
      //   if (Array.isArray(data)) {
      //     for (const item of data) {
      //       write({ type: "insert", value: item });
      //     }
      //   }
      //   commit();
      // },
    };
  };

  const onInsert = async (params: InsertMutationFnParams<TModel, string>) => {
    const data = await api
      .post(apiPath, {
        json: params.transaction.mutations.map((mutation) => ({
          data: mutation.modified,
        })),
      })
      .json<{ lastSyncId: number }>();
    awaitLastSyncId(data?.lastSyncId);
  };

  const onUpdate = async (params: UpdateMutationFnParams<TModel, string>) => {
    const data = await api
      .patch(apiPath, {
        json: params.transaction.mutations.map((mutation) => ({
          id: mutation.key,
          data: mutation.changes,
        })),
      })
      .json<{ lastSyncId: number }>();
    awaitLastSyncId(data?.lastSyncId);
  };

  const onDelete = async (params: DeleteMutationFnParams<TModel, string>) => {
    const data = await api
      .patch(apiPath, {
        json: params.transaction.mutations.map((mutation) => ({
          id: mutation.key,
        })),
      })
      .json<{ lastSyncId: number }>();
    awaitLastSyncId(data?.lastSyncId);
  };

  return {
    id: config.modelName,
    schema: config.schema,
    getKey: config.getKey || ((item) => (item as any).id),
    sync: { sync },
    onInsert,
    onUpdate,
    onDelete,
    utils: { bulkWrite: bulkWrite! },
    syncMode: config.syncMode || "eager",
    // syncMode: "on-demand",
  };
}
