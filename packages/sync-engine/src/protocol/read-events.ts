/** A minimal server-sent events parser: enough for `event`, `id` and single-line `data`. */
export interface ServerEvent {
  event: string;
  id?: string;
  data: string;
}

export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event: ServerEvent = { event: "message", data: "" };
        for (const line of block.split("\n")) {
          if (line.startsWith(":")) continue;
          const colon = line.indexOf(":");
          const field = colon < 0 ? line : line.slice(0, colon);
          const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") event.event = value;
          else if (field === "id") event.id = value;
          else if (field === "data") event.data += value;
        }
        if (event.data || event.event !== "message") yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
