/**
 * An SMTP server that accepts every message and keeps it, for the tests of what the server mails. Run as a script, it
 * also answers `GET /messages` on `SMTP_SINK_HTTP_PORT` with what it kept, for the browser suite to read.
 */

export interface SunkMail {
  to: string;
  subject: string;
  /** The message's source, quoted-printable soft breaks and escapes undone. */
  source: string;
}

const header = (source: string, name: string) =>
  new RegExp(`^${name}: (.*)$`, "mi")
    .exec(source)?.[1]
    ?.trim()
    .replace(/^.*<([^>]+)>$/, "$1") ?? "";

export function smtpSink(port = 0) {
  const messages: SunkMail[] = [];
  const server = Bun.listen<{ buffer: string; reading: boolean }>({
    hostname: "127.0.0.1",
    port,
    socket: {
      open(socket) {
        socket.data = { buffer: "", reading: false };
        socket.write("220 sink\r\n");
      },
      data(socket, chunk) {
        const state = socket.data;
        state.buffer += chunk.toString();
        for (;;) {
          const end = state.buffer.indexOf(state.reading ? "\r\n.\r\n" : "\r\n");
          if (end < 0) return;
          const part = state.buffer.slice(0, end);
          state.buffer = state.buffer.slice(end + (state.reading ? 5 : 2));
          if (state.reading) {
            state.reading = false;
            const source = part
              .replace(/=\r\n/g, "")
              .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
            messages.push({ to: header(source, "To"), subject: header(source, "Subject"), source });
            socket.write("250 queued\r\n");
          } else if (part.startsWith("DATA")) {
            state.reading = true;
            socket.write("354 go on\r\n");
          } else if (part.startsWith("QUIT")) socket.end("221 bye\r\n");
          else socket.write("250 ok\r\n");
        }
      },
    },
  });
  return { url: `smtp://127.0.0.1:${server.port}`, messages, stop: () => server.stop(true) };
}

if (import.meta.main) {
  const sink = smtpSink(Number(process.env.SMTP_SINK_PORT));
  Bun.serve({
    hostname: "127.0.0.1",
    port: Number(process.env.SMTP_SINK_HTTP_PORT),
    fetch: (request) =>
      new URL(request.url).pathname === "/messages"
        ? Response.json(sink.messages)
        : new Response(null, { status: 404 }),
  });
  console.log(`[smtp-sink] ${sink.url}`);
}
