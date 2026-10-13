# entwine

A local-first issue tracker. The whole workspace lives in the browser as TanStack DB collections, so views,
filters and navigation never wait for the network. Edits show at once and are confirmed by the server, and
every member sees them live.

## Local development

### Requirements

- [Bun](https://bun.sh) 1.4
- Optionally, Docker, to read the app's mail in a local inbox

### Getting started

1. **Install dependencies and seed demo data:**

   ```sh
   bun install
   bun run seed:demo
   ```

   This creates the workspace "acme" with three accounts, `ada@example.com`, `bob@example.com` and
   `cy@example.com`, all with the password `password123`.

2. **Optional: set up a local inbox.** By default, mail (invitations, password resets, address verification and
   notifications) is written to the backend's log. To read it as real mail, run
   [Mailpit](https://mailpit.axllent.org), a local inbox that catches everything sent to it:

   ```sh
   docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
   printf '\nSMTP_URL=smtp://localhost:1025\n' >> .env
   ```

   Mail can then be read at http://localhost:8025.

3. **Start the app:**

   ```sh
   bun run dev
   ```

   This starts the frontend on port 3000 and the backend on port 3001. If either port is in use, it takes the next
   free one and prints the address. Open the frontend's address in a browser and sign in.

Stop `bun run dev` before seeding again: only one process may use the data directory at a time. Settings in `.env`
take effect when `bun run dev` is next started.

### Trying it out

Sign in as different people in two browsers, or in a normal and a private window. Create an issue with `C`, drag it
across the board or add a comment, and the other window updates live. The Sync panel in TanStack Devtools shows
the connection, the cursor and the transactions waiting for the server.

### Common commands

| Command | Purpose |
| --- | --- |
| `bun run seed:scale` | Creates the workspace "scale" with 100,000 issues and edge cases, for the same accounts. |
| `bun run check` | Lints and formats with Biome. |
| `bun run typecheck` | Type-checks every package. |
| `bun run test` | Runs unit and integration tests. |
| `bun run test:e2e` | Runs the Playwright suite on freshly seeded databases. Needs ports 3000 and 3001 free. |

## Self-hosting

entwine runs as a single container that serves the app and its API, stores its data in a Docker volume and,
optionally, backs it up daily to an S3-compatible bucket.

### Quick start

Requires Docker with Compose. From a clone of this repository:

```sh
docker compose up -d --build
```

The app is available at http://localhost:3000. Create an account to begin; no settings are required for local use.

### Deploying to a server

1. **Clone the repository** on the server.
2. **Create `.env`** beside `compose.yaml`, with at least the app's public address. A typical production file:

   ```sh
   BETTER_AUTH_URL=https://tracker.example.com
   CLIENT_IP_HEADER=x-forwarded-for
   SMTP_URL=smtps://user:password@smtp.example.com:465
   MAIL_FROM=entwine <tracker@example.com>
   S3_BUCKET=my-entwine-backups
   S3_REGION=eu-central-1
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   ```

   Every setting is described under [Settings](#settings) and [Backups](#backups).
3. **Start the container:** `docker compose up -d --build`.
4. **Put an HTTPS reverse proxy in front of port 3000.** Browsers allow the offline store, push notifications
   and secure ids only on HTTPS or `localhost`. The proxy must stream responses without buffering, and its idle
   timeout must be longer than 25 seconds, the interval of the live stream's heartbeat. With
   [Caddy](https://caddyserver.com), which obtains certificates and streams by default, the whole configuration is:

   ```
   tracker.example.com {
       reverse_proxy localhost:3000
   }
   ```

   With nginx, add `proxy_buffering off;` and `proxy_read_timeout 60s;` to the `location` that proxies the app.
5. **Check it:** open `BETTER_AUTH_URL` in a browser and sign up. `docker compose ps` reports the container as
   `healthy` once it is serving.

After changing `.env`, apply it with `docker compose up -d`.

### Settings

All settings are optional and are read from `.env`, one `NAME=value` per line.

| Setting | Purpose |
| --- | --- |
| `BETTER_AUTH_URL` | The address users open, such as `https://tracker.example.com`. Default `http://localhost:3000`. Requests from any other origin are refused. |
| `CLIENT_IP_HEADER` | The header in which the proxy passes the client's address, usually `x-forwarded-for`, so that sign-in limits apply per client. Set it only behind a proxy; otherwise clients could forge it. |
| `SMTP_URL` | The mail server, as `smtps://user:password@smtp.example.com:465`, or `smtp://…:587` for a connection upgraded to TLS. |
| `MAIL_FROM` | The sender address, such as `entwine <tracker@example.com>`. Default `noreply@` the host of `BETTER_AUTH_URL`. |
| `DISABLE_WORKSPACE_CREATION` | `1` prevents new accounts from creating workspaces; they can still join by invitation. |
| `SYNC_REQUESTS_PER_MINUTE` | The loads and writes each member may send per minute. Default 500. |
| `BETTER_AUTH_SECRET` | The key that signs sessions. If unset, the server generates one on first start and stores it with its data. Changing it signs everyone out. |

Without `SMTP_URL`, no mail is sent: invitation links are written to the server's log and can be copied from the
workspace's settings, and password resets, address verification and notification mail are unavailable.

### Data

The `data` volume holds all accounts, workspaces, attachments, avatars, push keys and the generated secret. It
is a Docker volume rather than a host directory so that only the server opens its SQLite files. The server locks
the volume while it runs; a second container using the same volume refuses to start.

### Backups

Backups are stored in a bucket on any S3-compatible service (AWS S3, Cloudflare R2, Backblaze B2, MinIO and
others). They are disabled unless `S3_BUCKET` is set.

| Setting | Purpose |
| --- | --- |
| `S3_BUCKET` | The bucket name. Backups are stored as `backups/<time>.tar.gz`. |
| `S3_ENDPOINT` | The service's address, such as `https://<account>.r2.cloudflarestorage.com`. Leave unset for AWS. |
| `S3_REGION` | The bucket's region, for services that have regions. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Credentials permitted to list, read, write and delete objects under `backups/`. |

On AWS, the following IAM policy, attached to the user that owns the key, grants exactly what backups need:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::my-entwine-backups",
      "Condition": { "StringLike": { "s3:prefix": "backups/*" } }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::my-entwine-backups/backups/*"
    }
  ]
}
```

**Schedule.** The server makes a backup on first start and then once a day, while it keeps running. It keeps the
seven most recent and deletes older ones. A failed backup is logged and retried within the hour.

**Security.** A backup is a complete copy of `data`, including password hashes and the session secret. Keep the
bucket private.

**Commands:**

```sh
docker compose exec entwine bun run backup          # make a backup now
docker compose run --rm entwine bun run restore     # list available backups
```

**Restoring** replaces all current data with the backup's. The server must be stopped first:

```sh
docker compose stop
docker compose run --rm entwine bun run restore 2026-10-13T02-00-00.000Z
docker compose up -d
```

To move to another machine, set the same `S3_` settings in its `.env` and run the `restore` command there before
the first `docker compose up -d`.

### Upgrades

Make a backup, then rebuild from the new code:

```sh
docker compose exec entwine bun run backup
git pull
docker compose up -d --build
```

There are no database migrations yet. If a release cannot open an existing workspace, restore the backup and return
to the previous release.

### Without Docker

Requires [Bun](https://bun.sh) 1.4, and `tar` for backups.

```sh
bun install
bun run build
bun run start
```

Settings are read from the environment or from `.env` in the repository root, as listed above. `bun run backup` and
`bun run restore <backup>` work as described under [Backups](#backups). Two further settings apply:

| Setting | Purpose |
| --- | --- |
| `PORT` | The port to listen on. Default 3001. |
| `AUTH_DB_PATH`, `TENANT_DB_DIR` | Where data is stored. Default `data/auth.db` and `data/tenants/`. |

## License

entwine is licensed under the [GNU Affero General Public License v3.0](LICENSE). If you run a modified version
that others use over a network, you must offer them its complete source code under the same license.

## More

- [AGENTS.md](AGENTS.md): architecture and conventions
- [TESTING.md](TESTING.md): how it is tested
- [TODO.md](TODO.md): what phase 1 leaves out
