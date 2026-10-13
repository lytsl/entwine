# AGENTS.md

entwine is a local-first issue tracker: workspaces hold projects, projects hold issues. States group as
backlog/unstarted/started/completed/cancelled; priorities run urgent…none. `reference/` holds the research notes the
sync design came from: never edit it.

**YAGNI, KISS, DRY.** Build what a spec asks, in the simplest shape, each fact stated once. Agreed behaviour lives in
`openspec/`: propose a change there before building anything new.

## Stack

Bun · TypeScript · Hono · Prisma Next (8 rc) on SQLite · Better Auth · React + Vite · TanStack DB, Router, Query,
Form, Table, Virtual, Pacer, Hotkeys, Devtools · shadcn/ui on Base UI · Biome · Playwright.

## Architecture

```
packages/shared         used by backend AND frontend only: constants/, schemas/ (<model>Row, <name>Input, fields.ts,
                        rows.ts, sync.ts), utils/. Browser-safe, knows no database.
packages/sync-engine    schema-agnostic server sync: protocol/ (the wire, shared with clients), storage/,
                        controllers/ (one endpoint per file), errors/
packages/db-collection  schema-agnostic client sync: device/, workspace/ (Workspace: tab, rows, loader, dependents,
                        stream, outbox, history), react/ (provider, one hook per file)
packages/sync-devtools  TanStack Devtools panel for the sync client
packages/ui             shadcn/ui, the app's domain-free controls, icons, editor, Storybook
apps/backend/src        env.ts (sole reader of process.env), auth/, middleware/, routes/<domain>.ts under a thin
                        app.ts, services/, database/ (contract, emitted files, prepare.ts), writes/rules/<model>.ts
                        (shared parts in rules/shared/). Seeds, backup and restore in apps/backend/scripts.
apps/frontend/src       constants/, types/, contexts/, hooks/ (one per file), lib/ (pure helpers), services/,
                        preferences/, store/, components/, routes/
tests/integration       real backend and real sync clients in one process
tests/e2e               Playwright: a folder per suite, shared helpers/
```

Dependencies point one way: `sync-engine/protocol` ← `shared` ← `backend`, `frontend`; `sync-engine/protocol` ←
`db-collection` ← `sync-devtools`, `frontend`. The sync packages never name an entwine model: the app hands them
`syncSchema` (row schemas and load strategies), its write rules and its tables. Every write belongs to the backend.

**Storage.** Better Auth owns `data/auth.db`: accounts (with notification preferences), sessions, workspaces, members,
roles (owner, admin, member), invitations and push subscriptions, each a session's. Beside it are `avatars/`, the
push keys (`push-keys.json`), the `secret` a production server makes when given none, and `lock`, which the running
server holds so that a second one refuses to start (`services/data-lock.ts`). Each workspace is one SQLite file in
`data/tenants/`, made from the Prisma contract on first use (`prepareTenant`); the file is the tenant boundary, so
tables have no workspace column. Its `Member` directory
and `Workspace` row mirror the auth database (Better Auth hooks, plus a repair of the caller's entry on each request);
clients cannot write them. Attachment bytes live in `<workspace id>.files/<attachment id>`, uploaded before their row,
served only through it, attachable only by the uploader named in `<attachment id>.by`, and kept a day after the row so a
delete can be undone. Deleting a workspace writes a `<id>.deleting` mark, removes it from the auth database, then
`deleteWorkspaceData` ends its streams (`revoked`), removes its files and refuses the id; a start finishes marked
deletions. Nothing unmarked is deleted. Deleting an account deletes the workspaces it alone belongs to, is refused while
it is the only owner of one with other members, and leaves the rest (`forgetMember`). Notifications waiting for mail are
listed in `<workspace id>.mail` (`services/delivery`), so a restart still sends them.

**Backups.** With `S3_BUCKET`, the entry point runs `scripts/backup.ts --if-due` hourly, in a process of its own:
when the bucket's newest backup is a day old it copies the data to a temporary directory (`VACUUM INTO` for each
database, then the files beside it), packs it with `tar` and uploads it as one object (`services/backup.ts`).
Whatever comes to be kept in the data or tenant directory is backed up without being named there. The last seven
are kept. `bun run restore` replaces the data with one while no server runs.

**Sync** (from `reference/`):

1. The schema is a model registry: a model loads `instant` (in the bootstrap), `explicit` (when a page asks) or
   `on-demand` (when a live query asks, by its `where`). The one read endpoint, `POST /load`, answers a batch of
   queries (`{ model, where }`: a value, several values, a range, the words of a search, or another query's
   `select`ed field or none of it; `any` for alternatives; `order`, `limit` and `offset` for a part; `count` for
   numbers in place of rows) with the rows and the log position they are complete up to. The bootstrap loads the
   instant models; a project's pages load `issueQueries(scope)`; an issue's comments and activity load when its
   page queries them; the palette's search finds issues by key, title, description and comments
   (`issueSearchQueries`). Then the client follows `GET /stream` (SSE) from its cursor.
2. Every view is a live query over the collections. A change that brings a row into a held query's `select` (a
   relation to an issue of another project) loads that query again, narrowed to the row; an inserted row is followed
   only through its references, since what references it comes later. A page across projects holds a part:
   `issuePageQuery` asks the server for the first 100 issues of its filters in its order, and the total
   (`store/issue/issue-pages.ts`). The list is the held issues up to the last one loaded. It stays the server's
   answer because the stream brings every changed issue, and one that arrives alone is shown once its labels,
   modules and sub-issues are loaded (`whole`). `issueFilter` and `sortIssues` say the same as `issuePageQuery`;
   `page-query.test.ts` holds them equal.
3. Every held row carries its server version: the change id that wrote it, or the cursor of the load that read it.
   Only a newer version replaces it, and deletes keep theirs, so bootstrap, stream, loads and the stored copy may
   arrive in any order.
4. The UI edits the collections inside `mutate()`: the change shows at once and waits in the outbox. A tab sends its
   transactions to `POST /transactions` one at a time, in the order made, retrying while the server is unreachable,
   and TanStack DB drops the optimistic state only once the stream has delivered the result. A transaction carries
   its TanStack id and the server applies an id once, so resending when delivery is in doubt is safe.
5. The server applies a transaction all or nothing through the write rules, which validate, check permissions and set
   server-owned fields (issue numbers, authors, timestamps, activity). Every row it touches is appended to the
   tenant's change log with an ordered id and published to the tenant's streams. A refused transaction rolls back on
   the client and the UI shows the server's message.
6. The stream beats every 25 s; at each beat the server checks session and membership again, and a client that hears
   nothing for two beats reconnects. A reader that falls behind is dropped and catches up from its cursor. A cursor
   from another change log (the tenant's `Epoch`) or older than the log (changes are kept 30 days) gets `reset`: the
   client loads the workspace again in place, with the scopes pages hold. A deleted workspace is a revoked one to its
   clients: they delete their stored copy and leave for another.
7. Every tab follows the server itself and keeps its own collections. A member's tabs share an OPFS SQLite store: the
   Web Lock holder writes the stream into it (replaying from the store's cursor when it takes over), every tab writes
   its loads and keeps its unanswered transactions there, and the lock holder sends the transactions of a tab that
   closed before the server answered. A reload opens from the store without a bootstrap. Without OPFS or Web Locks a
   tab keeps the workspace in memory. Sign-out deletes stored data and tab history.
8. Every `mutate` can be undone and redone. The tab keeps transaction ids and optimistic inverses in session storage.
   Undo asks the server to revert the logged transaction; private `before` and `actorId` fields let it restore deleted
   rows and their dependents exactly. Redo reverts the undo. Neither private field goes on the wire.
9. A model may name an `owner` field in the sync schema (`Notification.memberId`): the engine loads and streams its
   rows to that member only, at any query depth, and refuses other members' writes to them. A stream event's id is
   the reader's position and may be ahead of the changes it carries, which may be none. `tenant.load` and the writer
   without a reader are the server's view.
10. All reads and writes of a tenant go through its queue: one connection, one writer, change ids in commit order.
    Idle connections are evicted; a `Tenant` is a handle that reopens its file when needed.

**Cycle schedules** (`services/cycle-schedule.ts`): one tenant write creates upcoming cycles and, with rollover, moves
open issues out of ended ones. An ended cycle counts what was moved out (`rolledIssues`, `rolledPoints`), which its
progress keeps as planned (`withRolled`). The schedule owns cycles without a creator and steps over others. It runs
after a transaction that changed a schedule, and before requests and at stream beats at most every 15 minutes
(`services/planner.ts`); there is no background job. "Today" is in the project's `cycleTimezone`.

## Conventions

**Data and writes**

- A model's fields are stated twice: in `contract.prisma` (then `bun run contract:emit`) and as its row schema in
  `@entwine/shared`; `contract.test.ts` keeps them equal. No migrations: a mismatched tenant file is rebuilt.
- SQLite has no `Boolean` and Prisma Next rejects `autoincrement()`: flags are `Int` 0/1, timestamps `Int` epoch ms.
- Client-created rows get UUIDs; a dependent row's id is `pairId` of what it joins (`issueId:labelId`, …), a
  reaction's `reactionId`, so later optimistic writes can reference it.
- Permissions and invariants live in the write rules; the UI may pre-check, the server decides. A rule deletes
  dependents itself, through the writer (SQLite cascades bypass the change log). Consequences for other members
  (subscriptions, notifications) go through `tell` in `rules/shared/notify.ts`.
- Server-initiated writes have no member (`actorId`/`creatorId` null) and no transaction id, so they can't be undone.
- Files are reached through `ctx.files` and served only by `routes/files.ts`: raster images inline, the rest as
  downloads, always `nosniff` and sandboxed. Rich text loads images only from the workspace's files.
- A mention is `[@Name](mention:<member id>)` (`mentionedIds`). A workspace's slug never changes and keys nothing but
  the last-workspace preference. A password change signs out the person's other sessions.

**Frontend**

- Components come from `@entwine/ui`; add one with `bunx shadcn@latest add <name> -c packages/ui`. A component with
  plain props (no workspace, rows, routes or shortcuts) belongs there. Others live in the `-components` folder of the
  deepest route directory holding every route that uses them, in domain folders; `src/components` only for those
  used across top-level routes. A `-components` folder holds components only.
- TanStack DB comes only from `@entwine/db-collection/react`: its live queries belong to the workspace, which retires
  them before its collections.
- Read and edit through the store (`useStore()`): one class per kind of row, one object of each in `root.ts`. Those
  objects never change identity, so memos and effects depend on `store` or on values read from it.
- No edit may cost a pass over every issue. Only `issue-index.ts` holds the issues the tab has; components use
  `store.issues`: `get`, `list(scope(…), query)`, a count (`progress`, `stateCounts`, …) or `useIssueSearch` (at
  most 100). A new need is a new count or scope there, never a loop in a component. No page loads every issue of
  the workspace: one across projects is `paged` (`useIssuePage`), and what it needs of all issues it asks the
  server to count (`useProjectProgress`). Long lists virtualize; a memoized row given `store` compares
  with `sameButIssues`.
- WCAG 2.2 AA from 320 px wide. Layouts answer their container (`@min-[…]/main`, `useFits`), not the viewport. Text
  colours: `text-primary-text`, `text-warning-foreground`, `textColor(…)` for status and project colours. Hover-only
  content is `hover-reveal`. Text fields are `max-md:text-base`, or phones zoom. A dialog returns focus on close.
- Shortcuts are rows of `SHORTCUTS`, bound with `useShortcuts`, hinted with `ShortcutKeys` or `tooltip`.
- A form is `useAppForm` + `form.AppForm`, validated on submit by a named `@entwine/shared` schema, with
  `field.TextField` and `form.SubmitButton`; it never restates a field's rule. One input committing on Enter or blur
  is not a form.
- A dialog is mounted while open and takes `onClose`; confirmations are `ConfirmDialog`. Property controls are
  `-components/pickers/<property>-picker.tsx`; issue layouts are folders of `-components/issue-views`.
- Name routes by path (`getRouteApi`, `useNavigate({ from })`), never by importing a route file. A route file holds its
  `Route` and its page.

**Layout of code**

- Kind first, then domain: a folder says what kind of thing it holds, a file which domain. A file has one
  responsibility (one component; helpers and types in their own modules); one that grows a second becomes a folder.
- Only an `index.ts` entry re-exports; no two modules import each other; helpers, hooks and types never import from
  `routes/`. Tests mirror the source's folders.

## Writing code

A cleanup of this repository found these mistakes throughout it. Don't write them.

- **No function that only forwards.** `useMentionPeople() { return useStore().members.people }`,
  `openWorkspace(o) { return new Workspace(o) }`, `const organizationId = workspaceId`: write the expression where it
  is used. A function earns its name by holding logic, fixing arguments, or being shared by several callers; a local
  helper used once must read better than its body.
- **Find before you write.** Look in `@entwine/shared` `utils/`, the frontend's `lib/`, `tests/e2e/helpers/` and the
  suite's `helpers.ts` first. A second copy of a helper (a spec's own `addDays`, `toggleFilter` rewriting
  `toggledList`, sign-in steps pasted into five specs) moves to the shared place instead.
- **Export only what another module imports**, and delete what nothing uses: functions, methods, types, re-exports,
  imports.
- **A comment says what the code can't**: why, a constraint or invariant, a unit, a coupling to a number or class
  elsewhere, what null means, a quirk. If a reader of the name, the type and the code would lose nothing without it,
  leave it out.
  - Not: `/** The member looking at the table. */ userId`, `/** Returns the issue's key. */`, `/** Plans the
    workspace now. */`, `// Click Save`, a test comment repeating the test's title.
  - But: `/** An owner or an admin. */ isAdmin` (the name hides owners), `/** The app's origin: a sync request that
    names another origin is refused. */`, `/** The height h-11 gives a row. */`.
- **A cleanup changes no behaviour.** A method tests use to observe behaviour (`History.canRedo`) is API, not dead
  code; a comment stating a rule the code doesn't show stays. In tests no assertion, selector, wait or title changes,
  and a shared helper replacing copies does exactly what they did (same headers, same `exact`).
- **Read a file whole before judging it**: grep finds callers, it does not replace reading. Never edit generated files
  (`contract.d.ts`, `contract.json`, `routeTree.gen.ts`).

## Commands

```sh
bun install
bun run seed:demo      # workspace "acme": ada|bob|cy@example.com / password123
bun run seed:scale     # workspace "scale": 100,000 issues and edge cases, same accounts
bun run dev            # backend :3001, frontend :3000 (proxies /api), each on the first free port
bun run check          # Biome
bun run typecheck
bun run test           # unit and integration
bun run test:e2e       # Playwright on fresh seeded databases; needs ports 3000 and 3001
```

[TESTING.md](TESTING.md) says how tests are written; [TODO.md](TODO.md) lists what is deliberately missing.

## Limits

- One backend process owns the data directory and holds its `lock`, seeds too: stop `bun run dev` to seed. Realtime
  fan-out is in-process, and bun:sqlite runs on its one thread (loads yield between queries and writes every 256 rows, but a workspace waits for its own long load or write).
- Without OPFS or Web Locks, unsent edits are lost if the tab closes.
- Mail goes through `SMTP_URL`; without it, development prints it and production offers no reset, address check
  or notification mail. A member keeps 200 notifications.
- Notification mail waits 5 minutes from a workspace's first unsent notification and goes per member and issue,
  for what is still unread, to verified addresses only. Push goes at once, from HTTPS or `localhost`.
- Sign-in attempts are limited per client address (behind a proxy, set `CLIENT_IP_HEADER`). Sync requests: 500 a
  minute per member (`SYNC_REQUESTS_PER_MINUTE`).
- Any account may create workspaces (`DISABLE_WORKSPACE_CREATION=1` refuses). Files are at most 10 MB, no quota, and
  uploads are not queued offline.
- Cycles roll over when a workspace is next used, not at midnight.
