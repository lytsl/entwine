/** An S3 endpoint that keeps one bucket's objects in memory, for the tests of backups. It checks no signature. */
export function s3Sink() {
  const objects = new Map<string, Blob>();
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      // Path style: `/<bucket>/<key>`.
      const key = decodeURIComponent(url.pathname).split("/").slice(2).join("/");
      if (url.searchParams.has("list-type")) {
        const prefix = url.searchParams.get("prefix") ?? "";
        const contents = [...objects.keys()]
          .filter((name) => name.startsWith(prefix))
          .sort()
          .map((name) => `<Contents><Key>${name}</Key></Contents>`);
        return new Response(
          `<ListBucketResult><IsTruncated>false</IsTruncated>${contents.join("")}</ListBucketResult>`,
          { headers: { "Content-Type": "application/xml" } },
        );
      }
      if (request.method === "PUT") {
        objects.set(key, await request.blob());
        return new Response(null, { headers: { ETag: '"sunk"' } });
      }
      if (request.method === "DELETE") {
        objects.delete(key);
        return new Response(null, { status: 204 });
      }
      const found = objects.get(key);
      if (!found) return new Response(null, { status: 404 });
      return new Response(request.method === "HEAD" ? null : found);
    },
  });
  return { objects, endpoint: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) };
}
