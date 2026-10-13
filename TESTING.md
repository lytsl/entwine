# Testing

Tests exercise real code on real SQLite files in temporary directories. Nothing of ours is mocked; the only
stand-ins are a mailer that records instead of logging, an SMTP sink (`apps/backend/test/helpers/smtp-sink.ts`)
that keeps what the server mails and that the browser suite reads through `helpers/mail.ts`, a pusher that records,
the integration harness's fetch wrapper, which
injects network faults, and its device: the workspace store over `bun:sqlite` in place of the OPFS worker, with a
lock queue shared by its clients. Each tab has session storage for undo; pass the same session to simulate a reload.
`holdWrites()` holds device writes to verify that first-visit readiness does not wait for persistence.

| Layer | Where | Runs with | Proves |
| --- | --- | --- | --- |
| Server sync | `packages/sync-engine/test` | `bun test` | on a toy schema of its own: tenant files and eviction, the change log and its pruning, queries and their checks, idempotent transactions, the endpoints' refusals, stream ordering, backpressure, reset |
| Shared | `packages/shared/test` | `bun test` | row types, schemas, the sync schema, derived ids, issue queries, filters and order, progress, dates |
| UI | `packages/ui/test` | `bun test` | what a browser test sees only by chance: the contrast of every avatar fill under its initials |
| Frontend | `apps/frontend/test` | `bun test` | pure logic of the app: the shortcut table and its key labels, palette search, the part of the issues a page across projects holds, cycle phases, state order |
| Backend | `apps/backend/test` | `bun test` | auth, membership boundaries, member directory, request bounds, role changes, the contract against the row schemas, and on real tenant files: the write rules, issue scopes, a page's query against the filter it mirrors, and server-side reverts |
| Integration | `tests/integration` | `bun test` | the custom collection against the real backend: optimistic writes, confirmation, rollback, retries, live updates, reconnect, stalls, revocation, sign-out, in-place rebuild, the device store, the offline outbox and its adoption by another tab, issue scopes and history on demand, shared tabs and takeover, release, undo after reload, and seeded convergence under faults |
| End to end | `tests/e2e` | Playwright | the app in Chromium against real servers on a freshly seeded data directory |

`tests/e2e` has a folder per suite, each holding its `playwright.config.ts`, its specs and, where it has them, its
`helpers.ts` and `seed.ts`: `app` (the browser suite), `audit-10k`, `audit-100k` and `a11y-sweep`. What suites share
is in `helpers/`: the `test` that signs in, the page actions, the servers a suite starts and the audits' seed rows.

## Rules

- Each specified behaviour is covered by a test at the lowest layer that can observe it. Write rules are
  tested through the transaction handler, the same entry point the HTTP route uses.
- Build state through the same paths production uses: transactions for tracker rows, Better Auth endpoints for
  accounts and workspaces. Write rows directly only to set up a condition no API can produce.
- Wait for outcomes (`eventually`, Playwright's `expect`), never for fixed delays.
- Every test owns its data: a fresh temporary directory per test, or unique names in e2e. The browser suite's specs
  import `test` from `helpers/test`, which closes the browser contexts a test opened when it ends.
- A failing test is fixed or reported, never skipped silently.
- Faults are injected at the network, never by changing our code: each integration client has a switchboard
  (`offline`, `failNextRequest`, `loseNextResponse`, `dropStream`, `stallStream`, `holdNextResponse`), and the
  harness takes a short `heartbeatMs` (and each client a `stallMs`) so that time-based behaviour runs in
  milliseconds.
- Randomized tests take a seed. The convergence test prints its seed in its name; replay a failure with
  `SEED=<n> bun test tests/integration/test/convergence.test.ts`, and keep a seed that found a bug as a fixed case.

## Commands

```sh
bun run test                         # every package's tests
bun test packages/sync-engine/test   # one package
bun run test:e2e                     # needs ports 3000 and 3001 free
```

## 10,000-issue Chromium audit

```sh
bun run test:audit                                      # development servers
bun run build
AUDIT_MODE=production bun run test:audit                # built frontend, production backend
```

Both modes use fresh temporary databases, one worker, headless Chromium, and zero retries. The audit seeds a
unique workspace through Better Auth and tracker HTTP APIs, with five projects of 2,000 issues, five workflow
groups and priorities, three assignees plus unassigned, labels, dates, estimates, cycles and modules. Seed dates
use the browser's Asia/Kolkata timezone. Each browser context has an independent cookie jar and empty app storage,
initialized with its member's API-seeded authentication cookies; the session API verifies the caller's identity.
This avoids artificial login bursts against production rate limits. Only deliberate same-member tab tests share
OPFS, a cookie jar and local storage. Contexts close in `finally` blocks.

The audit checks all five layouts, every filter field and ordering mode, virtualized scrolling, keyboard
navigation and bulk selection in the three layouts that support them, and separate-member synchronization,
offline edits, reloads, undo/redo and both follower and leader outbox takeover. Timestamp ties in batched API
creates have no specified UUID order; sort assertions compare the ordering fields and keyboard assertions verify
distinct rows and returning to the preceding row.

`tests/e2e/audit-results/<mode>/` contains JSON measurements, test results and failure traces. Each measurement
run uses three new member contexts, three complete layout/navigation rounds per context, and records cold
workspace navigation, warm document reload after a persisted edit-and-undo barrier, layout changes, searches, DOM counts, renderer heap after forced GC,
long tasks and CDP duration counters. Loading ends when all 10,000 issues are visible in the count and sync is live;
each round starts with an unmeasured Timeline selection so every timed layout selection changes the active layout.
Interaction measurements include Playwright dispatch/expect overhead, and search includes the intended 200 ms
debounce. Two animation frames settle paint before DOM/heap sampling. Heap excludes worker and native memory;
forced GC is diagnostic and changes subsequent timing. These are local-host measurements, not performance budgets.
The offline reload scenario blocks sync HTTP requests while keeping document/assets/auth reachable; a fully offline
first document request has no service worker to serve the app.

## Accessibility and narrow screens

`tests/e2e/app/accessibility.spec.ts` runs with the browser suite: axe (WCAG 2.2 A and AA) on every layout, an
issue, the new-issue dialog and the settings pages in both themes, a 320-pixel-wide page, the skip control and focus
returning from a dialog. A new page or overlay gets a line there.

`tests/e2e/a11y-sweep` is the wider, exploratory pass it came from, against servers started beforehand as the
100,000-issue audit's are (a development-mode backend: production limits the reloads' session requests):

```sh
SWEEP_OUT=<directory> bun run --cwd tests/e2e test:a11y-sweep
```

`sweep.spec.ts` visits every route and overlay at 320, 390, 768 and 1280 pixels in both themes, and writes axe's
violations, a layout probe (page overflow, controls cut off or under 24 pixels, text under 11 pixels) and a
screenshot of each to `SWEEP_OUT`. `probe.spec.ts` writes what axe cannot see: each tab stop and whether focus
shows on it, aria snapshots, live regions, form-error wiring, what moves under `prefers-reduced-motion`, and the
controls a touch screen never reveals. Both record and keep going; their output is read, not asserted.

See `docs/audit/report.md` for recorded results and limitations. Run the ordinary full browser suite separately
with `bun run test:e2e`; the scale audit has its own configuration to avoid contaminating its measurements with
concurrent tests.
