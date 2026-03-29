import type { WithOptional, WithRequired } from "@entwine/utility/types";
import {
  type CollectionConfig,
  type DeleteMutationFnParams,
  type InsertMutationFnParams,
  type LoadSubsetOptions,
  parseLoadSubsetOptions,
  type SyncConfig,
  TanStackDBError,
  type UpdateMutationFnParams,
  type UtilsRecord,
} from "@tanstack/db";
import { Store } from "@tanstack/react-store";
import type { DBSchema, IDBPDatabase, IDBPTransaction } from "idb";
import type { z } from "zod";
import { api } from "@/utils/api";
import type { BulkWrite, WebSocketClient } from "./ws-client";
import { syncEventBus } from "./events";
import { db, type IdbModelName } from "@/db";

interface WebSocketCollectionConfig<
  TModelName extends string,
  TModel extends object = Record<string, unknown>,
> extends WithOptional<
  Omit<
    WithRequired<CollectionConfig<TModel, string, z.ZodType<TModel>>, "schema">,
    "onInsert" | "onUpdate" | "onDelete" | "sync" | "id"
  >,
  "getKey"
> {
  modelName: TModelName;

  apiPath?: string;
}

interface WebSocketUtils<
  TModel extends object = Record<string, unknown>,
> extends UtilsRecord {
  bulkWrite: BulkWrite<TModel>;
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
  TModelName extends IdbModelName,
  TModel extends object = Record<string, unknown>,
>(
  config: WebSocketCollectionConfig<TModelName, TModel>,
): WithRequired<
  CollectionConfig<TModel, string, z.ZodType<TModel>>,
  "schema"
> & {
  utils: WebSocketUtils<TModel>;
} {
  config.apiPath ??= `sync/${config.modelName}`;
  const apiPath = config.apiPath!;
  const lastSyncId = new Store(0);

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

  let bulkWrite: BulkWrite<TModel>;

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
      begin();
      const tx =
        props.tx ??
        db.transaction([config.modelName, "_metadata"], "readwrite");
      const modelStore = tx.objectStore(config.modelName);
      const metadataStore = tx.objectStore("_metadata");

      await Promise.all(
        [
          data.map((item) => {
            write({
              type: item.action,
              value: item.data,
            });

            switch (item.action) {
              case "insert":
                return modelStore.add(item.data);
              case "update":
                return modelStore.put(item.data);
              case "delete":
                return modelStore.delete((item.data as any).id);
            }
          }),
          props.tx
            ? []
            : [
                tx.done,
                typeof props.lastSyncId === "number"
                  ? [
                      metadataStore.put(
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
