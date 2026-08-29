# Job inbox — design

Private Next.js app: one authenticated inbox of remote FE jobs, refreshed every 2 hours. You open listings from the dashboard and mark Apply or Reject. You do not browse the boards by hand.

Playbook this implements: `id-page` `docs/remote-job-search-parallel.md`. This repo is not `id-page`.

## Goal

Replace the daily “open six tabs, scan alerts” block with a single queue of **new** jobs that already match the playbook filters. Apply happens on the source site via the stored URL. Applied jobs keep a timestamp and a notes field for the rest of the process.

Success: weekday morning you only triage this app; 8–12 applies still happen on the boards, but discovery and reject-filtering do not.

## Out of scope (v1)

- Auto-apply, InMail, or outreach send
- LinkedIn or Wellfound scrape (pinned saved-search links only)
- Pipeline stages beyond `new | applied | rejected` (no screen/offer columns)
- Source auto-mute after 10 days with zero screens
- Public pages, SEO, or anything on the `id-page` deploy
- Vercel Pro / platform cron (Hobby stays; GitHub Actions triggers refresh)

## Constraints (locked)

| Decision | Value |
| --- | --- |
| Host | Vercel Hobby, same pattern as `id-page` |
| Trigger | GitHub Actions every 2h → `POST /api/refresh?source=` |
| Auth | Shared password, httpOnly cookie |
| DB | Turso (libSQL) — system of record for offers, state, and events |
| Actions | Apply, Reject. No Later. Unchanged `new` is later |
| Apply | Opens `url` in a new tab and sets `applied` + `appliedAt` |
| Detail | Salary and skills not on the default row; hover/expand |
| Fetch | All matching **new** offers since last **successful** fetch per source |

## Architecture

```text
GitHub Actions (2h, matrix of sources)
        │  Bearer REFRESH_SECRET
        ▼
Next.js on Vercel ── POST /api/refresh?source=himalayas
        │
        ├─ adapter.fetch()
        ├─ match playbook criteria
        ├─ drop instant rejects
        └─ upsert jobs + append events + write refresh_runs
                │
                ▼
              Turso
                ▲
Inbox / Applied / login  (cookie session)
```

One Actions **job** per source so a Hobby function stays inside the time limit. Product result of one tick is still the full delta from every board.

Manual Refresh is the same contract as Actions: the browser (or a server action) fires **one HTTP request per source**. No single invocation runs all six adapters (Hobby time limit).

## Data model

### `jobs`

Current row. Identity and user state live here.

| Column | Notes |
| --- | --- |
| `id` | Internal primary key |
| `source` | `jungle` \| `himalayas` \| `wwr` \| `justjoin` \| `nofluff` \| `remoteok` |
| `externalId` | Stable id from the source |
| `url` | Canonical posting URL (required) |
| `title`, `company` | |
| `track` | `A` (worldwide/EU remote) or `B` (Poland remote/B2B) |
| `salaryMin`, `salaryMax`, `salaryCurrency`, `salaryRaw` | Null/empty if source has none |
| `hardRequired`, `hardNice`, `softRequired`, `softNice` | JSON string arrays. Empty if absent. If the source does not split required/nice or hard/soft, put keywords in `hardRequired` |
| `rawJson` | Full adapter payload; unmapped fields are not discarded |
| `postedAt` | Source publish time when known |
| `status` | `new` \| `applied` \| `rejected` |
| `appliedAt` | Set once on Apply; never cleared by fetch |
| `notes` | Markdown; editable on Applied |
| `firstSeenAt`, `lastSeenAt` | |

Unique: `(source, externalId)`.

Fetch **must not** overwrite `status`, `appliedAt`, or `notes`. It may update title, salary, skills, `rawJson`, and `lastSeenAt`.

### `job_events`

Append-only. Every fetch insert, user action, and notable system decision.

| Column | Notes |
| --- | --- |
| `id` | |
| `jobId` | Required. Run metadata lives on `refresh_runs`, not here. |
| `type` | `fetched` \| `applied` \| `rejected` \| `notes_updated` \| `deduped` |
| `at` | |
| `actor` | `system` \| `user` |
| `payload` | JSON (e.g. previous notes hash, duplicate url) |

Apply, Reject, and notes save write the `jobs` row **and** an event in the same transaction.

### `refresh_runs`

| Column | Notes |
| --- | --- |
| `id` | |
| `source` | |
| `startedAt`, `finishedAt` | |
| `status` | `running` \| `ok` \| `failed` |
| `fetched`, `inserted`, `skipped`, `rejected` | Counts after filters |
| `error` | Adapter/schema failure message; empty on `ok` |
| `watermark` | `lastSuccessAt` used for this run (ISO) |

Each source has an effective watermark: `max(finishedAt)` among `status = ok` for that source. A failed run does not advance it.

Watermark is derived from `refresh_runs` only. No `source_cursors` table.

## Sources and criteria

### Ingested in v1

| `source` | How | Track default |
| --- | --- | --- |
| `himalayas` | Public JSON API (`/jobs/api/search`) | A |
| `wwr` | Public RSS | A |
| `remoteok` | Public JSON (`/api`) | A |
| `jungle` | Public listing JSON or HTML search page | A |
| `justjoin` | Public listing JSON used by their frontend | B |
| `nofluff` | Public listing JSON or search page | B |

If JustJoin / No Fluff / Jungle expose no stable JSON, the adapter parses the public listing HTML. Schema break → failed `refresh_run`, no writes.

### Not ingested in v1

| Surface | Behavior |
| --- | --- |
| LinkedIn | Header links only (`src/config/pinned-searches.ts`). EU: `("Senior Frontend" OR "Staff Frontend" OR "Frontend Engineer" OR "Frontend Team Lead") AND (React OR TypeScript) AND (Remote OR "fully remote") NOT (hybrid OR "3 days" OR "US only" OR "United States only")`. Poland: `("Senior Frontend" OR "Frontend Lead" OR "React") AND (Remote OR "w pełni zdalnie" OR B2B) AND (Poland OR Polska OR "EU remote")`. |
| Wellfound | Header link only (`https://wellfound.com/` senior frontend remote). No scrape. |

### Match criteria (keep if)

A job must look like senior/staff/lead frontend (or React/TS senior on PL boards) **and** remote-capable.

**Track A** (Himalayas, WWR, Remote OK, Jungle): title or tags match at least one of `Senior Frontend`, `Staff Frontend`, `Frontend Engineer`, `Frontend Team Lead`, or (React or TypeScript) plus a seniority signal (`Senior`, `Staff`, `Lead`, `Principal`). Must be remote / fully remote. Timezone or region, when present, must allow CET/EU (reject Pacific-only).

**Track B** (JustJoin, No Fluff): React or TypeScript, senior, fully remote, and B2B / kontrakt / contract when the source has a contract field. Poland or EU-remote location.

Override: a JustJoin/No Fluff row that is worldwide EU and not PL-specific may still be `B` if the source is PL; do not dual-insert.

### Instant reject (drop before insert)

Drop when any of these match title, description, location, or tags (case-insensitive):

- Office / hybrid / on-site / `3 days` / `2 days in`
- Country or visa list that does not include Poland or the EU (`US only`, `United States only`, `UK only` without EU, etc.)
- Pacific-only core hours (`PST only`, `PT hours`, `Pacific time only`) without CET overlap
- Agency / recruitment spam with no named product or client (title or company is a generic “for our client” with no product name)

Dropped jobs are counted on `refresh_runs.rejected` and are **not** inserted. No `jobs` row, no event.

### Dedup

Second row with the same normalized `url` and a different `(source, externalId)`: do not insert; write `job_events.type = deduped` pointing at the existing `jobId`.

## Refresh pipeline

1. Auth: `Authorization: Bearer REFRESH_SECRET`. Missing/wrong → 401. Unknown `source` → 400.
2. Insert `refresh_runs` with `status = running`.
3. `watermark = last ok finishedAt` for this source (null = full current board, still apply match + reject filters).
4. Adapter returns listings. Prefer `postedAt > watermark` when the API supports it; otherwise take the current dump and keep unknown ids or `postedAt > watermark`.
5. Map to the job record (empty skill/salary fields if absent).
6. Apply match criteria and instant rejects.
7. Upsert `(source, externalId)`: insert `new` + `fetched` event, or update allowed fields + `lastSeenAt` + `fetched` event. Never clobber user state.
8. Listings that disappeared: leave the row; do not auto-reject.
9. Close `refresh_runs`. On throw or timeout: `failed`, store `error`, **no** watermark advance, **no** partial batch if the adapter result was unparseable. If some rows were already validly upserted before a mid-loop crash, they stay; the next success window still uses the last **ok** watermark so gaps refill.

`GET` of the inbox does not fetch boards.

## Auth

- Env `APP_PASSWORD` and `SESSION_SECRET`.
- `POST /login` compares password; sets httpOnly, `Secure`, `SameSite=Lax` session cookie (signed, expiry 30 days).
- Middleware: all routes except `/login` and `/api/refresh` require a valid cookie. Unauthenticated HTML → redirect `/login`. Unauthenticated page APIs → 401.
- `/api/refresh` is bearer-only, never cookie-only, so a stolen session cannot trigger unbounded scrapes without the refresh secret. The logged-in Refresh button is a server action that sends the bearer from env.

One user. No OAuth, no Clerk.

## UI

### Inbox (`/`)

`jobs` where `status = new`, newest `firstSeenAt` first.

Default row: title, company, source, track. Title (or a dedicated control) is the source `url` (new tab).

Hover or expand (either is fine; use expand on touch): salary range when present (`salaryRaw` or min–max + currency); four skill lists, omit empty lists.

Actions: **Apply**, **Reject**. Apply opens `url` and persists `applied` / `appliedAt` / event. Reject persists `rejected` / event. Row leaves the inbox.

Header: LinkedIn EU link, LinkedIn Poland link, Wellfound link (URLs in config). Last refresh per source (ok/failed + time). Manual Refresh.

### Applied (`/applied`)

`status = applied`, newest `appliedAt` first. Show `appliedAt`. Notes textarea, debounce autosave, `notes_updated` event. Source link remains.

### Rejected

No UI in v1.

### Login (`/login`)

Password field only.

## Errors and stale data

- One source fails: other Actions matrix legs still run. Inbox shows last good rows. Banner: source, last success, last error.
- Schema/HTML break: fail the run; do not upsert a half-parsed batch from that response.
- Turso down: pages show a single error state; refresh returns 503.

## Testing

CI uses fixtures only. No live HTTP to boards.

- Instant-reject cases: office/hybrid, no PL/EU, Pacific-only, nameless agency → dropped; clean remote senior FE → kept
- Each adapter: checked-in JSON/RSS → expected row (url, salary, skill buckets, track)
- Upsert: second fetch does not overwrite `status`, `appliedAt`, `notes`; updates `lastSeenAt`; writes `fetched`
- Apply / Reject / notes: row + `job_events`
- Auth: no cookie → login; refresh without bearer → 401
- Dedup: same url, two ids → one `jobs` row + `deduped`

Post-deploy smoke (manual): trigger Actions or Refresh, confirm new rows and banner on a forced adapter error.

## Deploy and env

GitHub private repo → Vercel Hobby project (not the `id-page` project).

| Name | Role |
| --- | --- |
| `APP_PASSWORD` | Login |
| `SESSION_SECRET` | Cookie signing |
| `REFRESH_SECRET` | Actions + server Refresh |
| `TURSO_DATABASE_URL` | DB |
| `TURSO_AUTH_TOKEN` | DB |

GitHub Actions secrets: `VERCEL_REFRESH_URL` (absolute `/api/refresh`), `REFRESH_SECRET`. Workflow: `cron: "0 */2 * * *"` plus `workflow_dispatch`. Matrix: the six `source` values. `curl -X POST -H "Authorization: Bearer …" "$URL?source=$SOURCE"`.

Turso schema applied via a checked-in SQL migration run from a `db:migrate` script (local and once against prod).

## File sketch (for the later plan)

Not implementation. Boundaries:

- `src/lib/db` — Turso client, queries
- `src/lib/auth` — cookie, password
- `src/lib/filters` — match criteria + instant reject
- `src/lib/sources/<name>.ts` — one adapter per board, `fetchListings(): RawListing[]`
- `src/lib/refresh.ts` — pipeline
- `src/app/api/refresh/route.ts`
- `src/app/page.tsx` — inbox
- `src/app/applied/page.tsx`
- `src/app/login/page.tsx`
- `tests/fixtures` — per-source payloads

Adapters share a `NormalizedJob` type. UI never imports a source module.
