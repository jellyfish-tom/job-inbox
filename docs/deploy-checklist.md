# Deploy checklist

Operator steps after commit `a04529f` (CI + refresh workflows + README). Code side is done; everything below needs your accounts/secrets.

## 1. Push

```bash
git push origin main
```

CI workflow (`.github/workflows/ci.yml`) runs automatically on this push — check the Actions tab turns green.

## 2. Create Turso production database

```bash
turso db create job-inbox
turso db show job-inbox --url        # copy → TURSO_DATABASE_URL
turso db tokens create job-inbox     # copy → TURSO_AUTH_TOKEN
```

## 3. Run migrations against prod (once)

```bash
TURSO_DATABASE_URL=libsql://<db>.turso.io TURSO_AUTH_TOKEN=<token> bun run db:migrate
```

Expected output: `Applied 001_init.sql`, `Applied 002_filter_config.sql`.

## 4. Create Vercel project

- New Vercel Hobby project from the GitHub repo — **new project, not `id-page`**.
- Framework preset: Next.js (auto-detected). Bun is picked up from `packageManager` in `package.json`.

## 5. Set the five env vars in Vercel

Project → Settings → Environment Variables (Production):

| Name | Value |
| --- | --- |
| `APP_PASSWORD` | your login password |
| `SESSION_SECRET` | random, e.g. `openssl rand -hex 32` |
| `REFRESH_SECRET` | random, e.g. `openssl rand -hex 32` — keep it, needed in step 7 |
| `TURSO_DATABASE_URL` | from step 2 |
| `TURSO_AUTH_TOKEN` | from step 2 |

Then deploy (or redeploy if it already built without the vars).

## 6. Smoke the app itself

- Open `https://<app>.vercel.app` → should redirect to `/login`.
- Log in with `APP_PASSWORD` → empty inbox is fine at this point.

## 7. Set GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `VERCEL_REFRESH_URL` | `https://<app>.vercel.app/api/refresh` (absolute, no trailing `?`) |
| `REFRESH_SECRET` | same value as the Vercel env var |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | only if Standard Protection covers Production — from Vercel → Settings → Deployment Protection → Protection Bypass for Automation |

Production alias must be reachable by `curl`. If Vercel Authentication is on for Production, `POST /api/refresh` 302s to SSO and the cron never refreshes. Either scope Standard Protection to **Preview only**, or set the bypass secret above.

## 8. Manual smoke of the refresh workflow

- Actions tab → `refresh` workflow → **Run workflow** (`workflow_dispatch`).
- Expect 6 matrix jobs; each curls one source. Some boards may fail (dead API) — that's why `fail-fast: false`; the rest still run.
- Reload the app: new rows in the inbox, per-source status in the refresh banner.

## 9. Done — cron takes over

Schedule runs every 2h (`0 */2 * * *`). Nothing else to configure. If a source keeps failing, its error shows in the banner and in the Actions logs.

## Optional cleanup

```bash
git worktree remove .worktrees/thermo-phase-a   # stale, behind main
rm .ai/session-resume.md                        # Phase C info is outdated
```
