FROM oven/bun:1.4.2

WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile && bun run build

# The data directory is the volume: it holds every account and workspace, and belongs to one running container.
RUN mkdir data && chown bun:bun data
VOLUME /app/data
USER bun

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
HEALTHCHECK CMD bun -e "fetch('http://localhost:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["bun", "apps/backend/src/index.ts"]
