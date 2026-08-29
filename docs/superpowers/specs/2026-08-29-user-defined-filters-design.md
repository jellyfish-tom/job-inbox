# User-defined filters — design

Let the operator define the accept/reject rules in the UI instead of editing `src/lib/filters.ts`. Two editable filter sets (Track A, Track B) drive fetch-time ingest, and a lightweight client-side filter narrows the already-collected inbox.

Builds on: `docs/superpowers/specs/2026-08-29-job-inbox-design.md`.

## Goal

Today the accept/reject logic is hardcoded constants in `src/lib/filters.ts` (instant-reject keywords plus baked-in Track A/B rules). Changing what enters the inbox means editing code and redeploying. This feature moves that configuration into the database, editable from a `/filters` page, and adds a view-time text/toggle filter over the inbox.

Success: the operator can add/remove keywords for each track and change what gets ingested without touching code, and can narrow the visible inbox on the fly.

## Scope

In scope:
- Persisted, per-track keyword filter config (seeded from current defaults).
- A `/filters` settings page to edit both track sets.
- Config-driven `filters.ts` (pure functions take config, no hardcoded constants).
- Ingest reads config per refresh run.
- Client-side view filter (text + source/track toggles) on the inbox.

Out of scope (v1):
- Structured per-field rule builder, operators, regex, AND/OR trees (keyword lists only).
- Arbitrary user-named filter sets (exactly two, keyed to the existing A/B tracks).
- Retroactive re-evaluation of already-collected jobs when rules change (only future fetches are affected; the view filter covers ad-hoc narrowing).
- Per-source filters (filtering stays keyed on the job's assigned track).

## Filter model

A job passes a track when it matches **at least one keyword in every** required group (AND of ORs) and matches **none** of the exclude keywords.

```ts
type KeywordGroup = { label: string; keywords: string[] };
type TrackFilter = { requiredGroups: KeywordGroup[]; exclude: string[] };
```

Matching is unchanged from today: build a lowercased haystack from `FilterInput` (`title`, `company`, `description`, `location`, `tags`, and — new — `contractType` folded in) and test with substring `includes`.

- Instant reject: any `exclude` keyword found in the haystack → rejected.
- Criteria match: every `requiredGroups[i]` has ≥1 keyword found in the haystack.
- An empty `requiredGroups` means "no positive requirement" (matches all not excluded); an empty `exclude` excludes nothing.

## Data model

New table (in a new migration, additive):

```sql
CREATE TABLE filter_config (
  track TEXT PRIMARY KEY,        -- 'A' | 'B'
  config TEXT NOT NULL,          -- JSON: TrackFilter
  updated_at TEXT NOT NULL
);
```

The table starts **empty**. Defaults live in one code module `src/lib/filter-defaults.ts` (`DEFAULT_FILTERS: Record<Track, TrackFilter>`), and `getFilterConfig(track)` returns the stored row if present, otherwise the code default. This avoids duplicating the default JSON in SQL. The defaults reproduce the current `filters.ts` behavior, so ingest is unchanged until edited:

Defaults are **bilingual (PL/EN)** because Polish boards mix languages in descriptions. Polish stems exploit substring matching (`zdaln` → zdalnie/zdalna/zdalny, `stacjonarn` → stacjonarna/stacjonarnie, `hybryd` → hybryda/hybrydowo), so one entry covers all inflections. This is a starting point; the operator edits per track.

- Shared exclude (both tracks): `hybrid`, `hybryd`, `on-site`, `onsite`, `stacjonarn`, `office days`, `days in office`, `dni w biurze`, `w biurze`, `us only`, `united states only`, `uk only`, `pst only`, `pt hours`, `pacific time only`, `3 days`, `2 days in`.
- Track A required groups:
  - remote: `remote`, `fully remote`, `zdaln`, `w pełni zdalnie`
  - tech/role: `react`, `typescript`, `frontend`
  - seniority: `senior`, `staff`, `lead`, `principal`, `starszy`
- Track B required groups:
  - tech: `react`, `typescript`
  - seniority: `senior`, `staff`, `lead`, `principal`, `starszy`
  - remote: `remote`, `fully remote`, `zdaln`, `w pełni zdalnie`
  - market: `poland`, `polska`, `polsce`, `eu remote`
  - contract: `b2b`, `kontrakt`, `contract`

Reads/writes are whole-document per track. `queries.ts` gains `getFilterConfig(track): Promise<TrackFilter>` (falls back to `DEFAULT_FILTERS[track]` on missing/malformed row), `saveFilterConfig(track, config): Promise<void>`, `resetFilterConfig(track): Promise<void>` (deletes the row so reads fall back to defaults), and `getAllFilterConfigs(): Promise<Record<Track, TrackFilter>>`.

The migration is additive (`db/migrations/002_filter_config.sql`, `CREATE TABLE IF NOT EXISTS`). `scripts/migrate.mjs` is generalized to run every `db/migrations/*.sql` in filename order (not just `001`), so `002` and future migrations apply.

## Filter engine (`src/lib/filters.ts`)

Refactor to config-driven pure functions:

```ts
export function isInstantReject(input: FilterInput, filter: TrackFilter): boolean;
export function matchesCriteria(input: FilterInput, filter: TrackFilter): boolean;
```

The hardcoded `INSTANT_REJECT_*`, `hasRemote/hasSeniority/hasReactOrTs`, and `matchesTrackA/B` constants are removed; their content lives in the seed. The haystack helper is extended to include `contractType`.

## Ingest wiring (`src/lib/refresh.ts`)

`refreshSourceWith` loads both track configs once at the start of a run and selects the config for each job's track before calling `isInstantReject` / `matchesCriteria`. `buildFilterInput` is unchanged (still a projection). The `refreshSourceWith(adapter, source)` test seam stays; config loading happens inside it so tests can seed the DB.

## UI

- `/filters` page (added to the site nav): renders both track sets. Each track shows its required groups (add group, remove group, edit a group's label and keywords) and the exclude list. Keywords are edited as comma/newline-separated text, normalized to a trimmed, lowercased, de-duplicated list on save.
- A server action `saveFilterConfigAction(track, config)` validates shape (arrays of strings, non-empty group labels) and persists JSON; `revalidatePath('/filters')`.
- A per-track "Reset to defaults" action calls `resetFilterConfig(track)` (deletes the row, so reads fall back to `DEFAULT_FILTERS`).

## View-time filter (inbox)

Client component on `/`: a text input plus source and track toggles that narrow the already-rendered rows in the browser. Text matches against title/company/tags. No server round-trip, no schema impact. Empty filter shows everything.

## Data flow

```text
/filters page ──(server action, JSON)──▶ filter_config table
                                              │
GitHub Actions / UI refresh ─▶ refreshSourceWith ─(load both tracks)─▶ filters.ts
                                              │
                                     accept → upsert into inbox
inbox page ─(server render all 'new')─▶ client view filter narrows display
```

## Error handling

- Malformed/missing config row: `getFilterConfig` falls back to the code default for that track and the run proceeds (never crash a refresh on bad config).
- Save validation rejects non-string keywords or empty group labels with a field error; nothing is persisted on failure.
- View filter is pure client state; no error paths.

## Testing

- Filter engine: AND-of-ORs pass/fail, exclude short-circuits, empty `requiredGroups` matches all, empty `exclude` excludes nothing, `contractType` folded into haystack.
- Default parity: `DEFAULT_FILTERS` reproduce current accept/reject decisions on the existing adapter fixtures (Track A remote React senior accepted; hybrid rejected; Track B Polish B2B React senior accepted).
- Queries: `getFilterConfig` round-trips a saved row; falls back to `DEFAULT_FILTERS[track]` on missing/malformed row; `resetFilterConfig` restores fallback.
- Refresh: a run reads config and applies it (edited config changes accept/reject outcome via `refreshSourceWith` with a seeded DB).

## Behavior changes from the keyword model (intentional)

The move to grouped keyword lists simplifies three current behaviors into the model; all are editable in the UI afterward:

1. Track A's "a frontend job title passes even without a seniority word" shortcut becomes a plain seniority group requirement (`[remote] AND [react/typescript/frontend] AND [senior/staff/lead/principal]`) — slightly stricter by default.
2. The two instant-reject regexes (`\b3 days\b`, `\b2 days in\b`) become substring excludes (`3 days`, `2 days in`).
3. The Track B `contractType` B2B check becomes a required group matched against the haystack (with `contractType` folded in).
4. The compound "title contains 'for our client' AND description contains 'confidential client'" reject is dropped (a keyword list can't express a two-field AND); add `confidential client` to an exclude list if you want a simpler version.

## Related / future work (separate feature)

Date-range-based fetch (request jobs posted within a chosen window instead of a fixed quantity) is a separate feature with its own spec. It touches the `SourceAdapter.fetchListings` contract (date bound + per-source pagination), not the matching logic here. Feasibility varies by source: justjoin (cursor + `itemsCount`) and nofluff (`page`) support true date-bounded paging; remoteok, wwr, himalayas, and jungle have no server-side depth control, so a range degrades to filtering the returned feed. Its config UI may share the `/filters` page. Not in scope for this spec.
