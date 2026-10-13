# 100,000-issue audit

An exploratory audit in headless Chrome against a production-mode backend and the built frontend, on ports of its
own (4100 for the app, 4101 for the API), so it runs beside anything on 3000 and 3001. The specs note what they
measure and what looks wrong to `audit-results/notes-100k.jsonl` and keep going: a failed step is a line to read,
not the end of the run.

```sh
bun run build
export DATA=$(mktemp -d)
NODE_ENV=production PORT=4101 AUTH_DB_PATH=$DATA/auth.db TENANT_DB_DIR=$DATA/tenants \
  BETTER_AUTH_SECRET=<32+ characters> BETTER_AUTH_URL=http://localhost:4100 bun apps/backend/src/index.ts &
bun tests/e2e/audit-100k/serve.ts &
cd tests/e2e
AUDIT_OUT=$DATA/dataset.json bun audit-100k/seed.ts
mkdir -p audit-results/100k audit-results/shots-100k
AUDIT_DATASET=$DATA/dataset.json bun run test:audit-100k
```

The seed goes through the HTTP API: ten projects of 10,000 issues with states, priorities, assignees, labels,
dates, estimates, cycles and modules, an eleventh project of hostile and awkward titles, an issue with 2,000
comments, three members, an account with no membership and a second workspace.

The specs run in file order, once, on a fresh seed: they edit and delete rows, and `08-scale-ops` deletes a label,
a cycle and a project. `09-resilience` has one test that needs the backend stopped and started under it: set
`AUDIT_MARKER` to a path, stop the backend when `<path>.ready` appears and start it after `<path>.edited` does.
`fixes.spec.ts` checks the defects the audit led to fixing, and also runs alone on a fresh seed.
