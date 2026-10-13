import { type Collections, type SessionStore, type SyncError, Workspace } from "@entwine/db-collection";
import { type Rows, syncSchema } from "@entwine/shared";
import { type Change, type LoadRequest, type Query, readEvents } from "@entwine/sync-engine/protocol";
import { type Device, localStore, sessionStore } from "./device";

export const ORIGIN = "http://localhost:3000";

/** Switches that make one client's network misbehave. */
export interface Faults {
  /** While set, every request fails before reaching the server. */
  offline: boolean;
  /** The next transaction fails before reaching the server. */
  failNextRequest(): void;
  /** The next transaction reaches the server, which applies it, but its answer is lost. */
  loseNextResponse(): void;
  dropStream(): void;
  /** Keeps the open stream open but lets nothing more through, heartbeats included. */
  stallStream(): void;
  /**
   * Holds the answer to the next request whose path or body contains `match`: the server has answered it, but the
   * client sees the answer only once `release` is called.
   */
  holdNextResponse(match: string): { reached: Promise<void>; release(): void };
}

export interface Client {
  workspace: Workspace<Rows>;
  collections: Collections<Rows>;
  mutate(fn: () => void): Promise<void>;
  faults: Faults;
  received: number[];
  /** Every path the client requested, without the query. */
  paths: string[];
  /** The queries of every load the client sent, in order. */
  loads: Query[][];
  /** Kept writes the server refused without anyone waiting for them. */
  refused: SyncError[];
  requests(): number;
  close(): Promise<void>;
}

export interface ClientOptions {
  stallMs?: number;
  device?: Device;
  offline?: boolean;
  session?: SessionStore;
}

/** The backend as a client reaches it: its requests, and where the streams it has open are kept to be cancelled. */
export interface Network {
  request(path: string, init?: RequestInit, cookie?: string): Promise<Response>;
  streams: Set<() => Promise<void>>;
}

/**
 * Opens a workspace and waits until it is ready. On a `device`, the client keeps the workspace there; `offline`
 * starts it with the network down.
 */
export async function openClient(
  { request, streams }: Network,
  cookie: string,
  workspaceId: string,
  options: ClientOptions = {},
): Promise<Client> {
  const received: number[] = [];
  const paths: string[] = [];
  const loads: Query[][] = [];
  const refused: SyncError[] = [];
  let failNext = false;
  let loseNext = false;
  const holds: { path: string; reached(): void; released: Promise<void> }[] = [];
  let stream = { drop() {}, stall() {} };
  const faults: Faults = {
    offline: options.offline ?? false,
    failNextRequest: () => void (failNext = true),
    loseNextResponse: () => void (loseNext = true),
    dropStream: () => stream.drop(),
    stallStream: () => stream.stall(),
    holdNextResponse(path) {
      let reached!: () => void;
      let release!: () => void;
      const reaching = new Promise<void>((resolve) => {
        reached = resolve;
      });
      holds.push({ path, reached, released: new Promise((resolve) => (release = resolve)) });
      return { reached: reaching, release };
    },
  };
  const fetch = async (url: string, init?: RequestInit) => {
    paths.push(url.slice(ORIGIN.length).split("?")[0]);
    if (url.endsWith("/load")) loads.push((JSON.parse(String(init?.body)) as LoadRequest).queries);
    const post = init?.method === "POST";
    if (faults.offline || (post && failNext)) {
      if (post) failNext = false;
      throw new TypeError("fetch failed");
    }
    const response = await request(url.slice(ORIGIN.length), init, cookie);
    if (post && loseNext) {
      loseNext = false;
      await response.arrayBuffer();
      throw new TypeError("fetch failed");
    }
    const hold = holds.find((h) => url.includes(h.path) || String(init?.body ?? "").includes(h.path));
    if (hold) {
      holds.splice(holds.indexOf(hold), 1);
      hold.reached();
      await hold.released;
    }
    if (!url.includes("/stream") || !response.body) return response;
    return new Response(tap(response.body), { status: response.status, headers: response.headers });
  };

  /** Forwards the stream to the client, recording the change ids it lets through, until dropped or stalled. */
  function tap(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const reader = body.getReader();
    let cancellation: Promise<void> | undefined;
    const cancel = () => {
      cancellation ??= reader.cancel().finally(() => streams.delete(cancel));
      return cancellation;
    };
    streams.add(cancel);
    const toClient = new TransformStream<Uint8Array, Uint8Array>();
    const toRecord = new TransformStream<Uint8Array, Uint8Array>();
    const client = toClient.writable.getWriter();
    const record = toRecord.writable.getWriter();
    let stalled = false;
    stream = {
      drop() {
        void client.abort(new Error("dropped"));
        void cancel();
      },
      stall: () => void (stalled = true),
    };
    // The client cancelling its end (closing, or giving up on a stall) ends the server's stream too.
    client.closed.catch(() => cancel().catch(() => {}));
    void (async () => {
      for (let r = await reader.read(); !r.done; r = await reader.read()) {
        if (stalled) continue;
        await record.write(r.value);
        await client.write(r.value);
      }
    })()
      .catch(() => {})
      .finally(() => {
        for (const writer of [record, client]) writer.close().catch(() => {});
      });
    void (async () => {
      for await (const event of readEvents(toRecord.readable)) {
        if (event.event === "changes") received.push(...(JSON.parse(event.data) as Change[]).map((c) => c.id));
      }
    })().catch(() => {});
    return toClient.readable;
  }

  const opened = new Workspace({
    schema: syncSchema,
    url: `${ORIGIN}/api/w/${workspaceId}`,
    stallMs: options.stallMs,
    fetch,
    local: options.device && localStore(options.device),
    session: options.session ?? sessionStore(),
    onError: (error) => refused.push(error),
  });
  await opened.ready;
  return {
    workspace: opened,
    collections: opened.collections,
    mutate: (fn) => opened.mutate(fn),
    faults,
    received,
    paths,
    loads,
    refused,
    requests: () => paths.length,
    close: () => opened.release(),
  };
}
