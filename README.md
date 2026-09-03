# job-inbox

Private remote-FE job inbox. One authenticated queue of matching remote frontend jobs, refreshed every 2 hours via GitHub Actions.

- Design: [docs/superpowers/specs/2026-08-29-job-inbox-design.md](docs/superpowers/specs/2026-08-29-job-inbox-design.md)
- Plan: [docs/superpowers/plans/2026-08-29-job-inbox.md](docs/superpowers/plans/2026-08-29-job-inbox.md)

## Local development

```bash
cp .env.example .env   # fill in values below
bun install
bun run db:migrate     # applies db/migrations/001_init.sql and 002_filter_config.sql
bun run dev
```

Tests, typecheck, lint (same as CI):

```bash
bun run typecheck && bun run lint && bun run test
```

## Environment variables

| Name | Role |
| --- | --- |
| `APP_PASSWORD` | Login password (single shared user) |
| `SESSION_SECRET` | Session cookie signing |
| `REFRESH_SECRET` | Bearer token for `POST /api/refresh` (Actions + server Refresh button) |
| `TURSO_DATABASE_URL` | Turso libSQL URL (`file:local.db` for local dev) |
| `TURSO_AUTH_TOKEN` | Turso auth token (empty for local file DB) |

## Deploy

1. Create a **new** Vercel Hobby project for this repo (not the `id-page` project).
2. Set the five environment variables above in Vercel.
3. Create a Turso database and run the migration once against it:

```bash
TURSO_DATABASE_URL=libsql://<db>.turso.io TURSO_AUTH_TOKEN=<token> bun run db:migrate
```

4. Set GitHub Actions secrets:

| Secret | Value |
| --- | --- |
| `VERCEL_REFRESH_URL` | Absolute refresh endpoint, e.g. `https://<app>.vercel.app/api/refresh` |
| `REFRESH_SECRET` | Same value as the Vercel env var |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Optional. Needed if Vercel Authentication covers Production |

## Refresh schedule

`.github/workflows/refresh.yml` runs every 2 hours (plus manual `workflow_dispatch`), one matrix job per source (`himalayas`, `wwr`, `remoteok`, `jungle`, `justjoin`, `nofluff`) so each Vercel Hobby invocation handles a single board. A failing source does not cancel the others.
