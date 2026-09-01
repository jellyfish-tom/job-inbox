# Per-source filters — design

Replace Track A/B haystack ingest with **per-source fetch params + field-scoped match**, using only fields each board actually exposes. Remove Track A/B from the product.

Supersedes ingest/config parts of `docs/superpowers/specs/2026-08-29-user-defined-filters-design.md`. Inbox view-time text + source toggles stay. Track toggles go away.

Builds on: `docs/superpowers/specs/2026-08-29-job-inbox-design.md`.

## Goal

Each source is queried and judged in its own vocabulary (`justjoin` `skills=React` + `experienceLevels=senior`, `himalayas` `q` + `seniority`, `nofluff` POST `criteria`, and so on). The operator edits those values on `/filters`. Listings are kept when present fields match and text exclude does not fire. Missing or sentinel `any` on a field does not fail that field.

Success: a justjoin refresh can ingest remote senior React roles instead of rejecting the first 10 unfiltered listings against a Track B haystack. No Track A/B in UI, types, or ingest.

## Scope

In scope:

- Code-declared `SourceCapabilities` per adapter (fetch / match / both).
- Persisted `SourceFilter` per source, defaults in code, editable on `/filters`.
- `fetchListings` consumes fetch-field values in the board’s query format.
- Post-fetch match is field-scoped (OR in field, AND across constrained fields).
- Exclude on `title` + `description` + tags (`hardRequired` ∪ `hardNice`) only.
- Remove Track A/B from UI, `NormalizedJob`, inbox view filter, `/filters`, and ingest.
- New `source_filter_config` table. Stop using `filter_config` (track PK).

Out of scope (v1):

- Date-range fetch / operator-facing pagination.
- Retroactive re-score of existing rows when rules change.
- Freeform extra query params the catalog does not declare.
- Dropping `jobs.track` or `filter_config` in SQL (columns/tables remain unused).
- Changing Apply/Reject, auth, or the six-source refresh matrix.

## Track removal

Track A (worldwide/EU) vs B (Poland B2B) is not used for decisions once filters are per source. Remove it from the product:

- Drop `Track`, `TrackFilter`, `FilterInput.track`, `NormalizedJob.track`.
- Adapters stop assigning `"A"` / `"B"`.
- Inbox/Applied meta is `company · source` (no `Track X`).
- Inbox view filter: text + source checkboxes only.
- `/filters` is six source editors, not two track editors.
- `refreshSourceWith` takes one `SourceFilter` for that source.

`jobs.track` stays `NOT NULL` in `001_init.sql`. Upsert writes `"-"` so existing DBs keep working. Nothing reads it. `filter_config` is unread; no backfill of old Track A/B JSON (shapes do not map).

## Filter model

### Catalog (code, not editable)

```ts
type FieldKind = "fetch" | "match" | "both";

type SourceField = {
  id: string;
  label: string;
  kind: FieldKind;
  valueType: "tokens" | "enum";
  enumValues?: string[];
  queryKey?: string;
};

type SourceCapabilities = {
  source: SourceId;
  fields: SourceField[];
};
```

`kind: "fetch" | "both"` with `queryKey` is sent on the request. `kind: "match" | "both"` is checked after normalize. A field the API ignores must be `match` only (justjoin `workplaceType`).

v1 catalog:

| Source | Fetch | Match-only |
| --- | --- | --- |
| justjoin | `skills`, `experienceLevels` | `workplaceType`, `employmentTypes` |
| himalayas | `q`, `seniority` | `categories`, `employmentType` |
| nofluff | `criteria` | `remote`, `skills` |
| jungle | `query` | `skills`, `workplace_type` |
| remoteok | — | `tags` |
| wwr | — | `title` (tokens on title only; description is exclude-only) |

Enums use the board’s strings (`senior`, `Senior`, `remote`, `fully`). Token fields are comma/newline lists in the UI.

### Stored document

```ts
type SourceFilter = {
  values: Record<string, string[]>;
  exclude: string[];
};
```

Empty `values[fieldId]` (missing or `[]`) = no constraint on that field. Reset deletes the row; reads fall back to `DEFAULT_SOURCE_FILTERS[source]`.

Sanitize: trim tokens, drop empties, drop keys not in that source’s catalog, de-dupe case-insensitively while preserving first spelling.

### Matching

Project a listing to `MatchInput`:

```ts
type MatchInput = {
  title: string;
  description: string;
  tags: string[];
  fields: Record<string, string[]>;
};
```

`tags` = `hardRequired` + `hardNice`. `fields` is filled by the adapter (or a per-source projector) from listing data, **not** from a concatenated haystack. Examples: justjoin `workplaceType: ["remote"]`, `employmentTypes: ["b2b"]` or `["any"]`; himalayas `categories` after the existing skill-slug filter.

1. **Exclude:** any non-empty exclude token is a substring of lowercase `title`, `description`, or joined `tags` → reject.
2. **Required fields:** for each catalog field with a non-empty configured value list:
   - Listing values missing, empty, or only sentinels (`any`) → **pass**.
   - Else at least one configured token is a case-insensitive substring of at least one listing value.
3. AND across those fields.

Do not invent `Poland` or fold `contractType` into a blob.

Existing inbox rows still skip this gate on refresh (update payload only). Rule edits do not re-litigate old jobs.

## Adapter contract

```ts
type SourceAdapter = {
  source: SourceId;
  capabilities: SourceCapabilities;
  fetchListings(filter: SourceFilter): Promise<unknown[]>;
  normalize(raw: unknown): NormalizedJob;
  matchFields(raw: unknown, job: NormalizedJob): Record<string, string[]>;
};
```

`fetchListings` reads only fetch/both values and builds the board URL/body. Pagination stays hardcoded: justjoin 3×100 (`from` + `itemsCount`); himalayas `limit=20`; nofluff `page: 1`. Not on `/filters`.

`matchFields` returns values for match/both field ids. Refresh calls `matchesSource(matchInput, filter, capabilities)` — not `filters[job.track]`.

## Data store

New migration `003_source_filter_config.sql`:

```sql
CREATE TABLE IF NOT EXISTS source_filter_config (
  source TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Queries: `getSourceFilter(source)`, `getAllSourceFilters()`, `saveSourceFilter(source, config)`, `resetSourceFilter(source)`. Missing/malformed → `DEFAULT_SOURCE_FILTERS[source]`.

`getFilterConfig(track)` / `filter_config` are deleted from app code.

## Defaults

Shared text exclude (hybrid / on-site / office-days / US-UK-TZ-only), applied per source as `exclude` — not as fake location tokens:

- justjoin: `skills: [React]`, `experienceLevels: [senior]`, `workplaceType: [remote]`, `employmentTypes: []`
- himalayas: `q: [react]`, `seniority: [Senior]`, `categories: [react, typescript, frontend]`
- nofluff: `criteria: [senior frontend react typescript remote]`, `remote: [fully]`, `skills: [react, typescript]`
- jungle: `query: [frontend senior]`, `skills: [react, typescript]`, `workplace_type: [remote]`
- remoteok: `tags: [react, typescript]`
- wwr: `title: [react, typescript, frontend, senior]`

`criteria` / `q` / `query` are single-string fetch fields: UI is one line; stored as `string[]`. The adapter joins tokens with a single space when building the request (`q=react`, `criteria=senior frontend react typescript remote`).

## UI

`/filters`: one `Section` per `SOURCE_IDS` entry, generated from `capabilities.fields`. Tokens → textarea; enums → multi-select of `enumValues`. Hint per field: sent to API / checked after fetch / both. One exclude textarea. Save and Reset per source.

Inbox: drop Track A/B checkboxes and tests for track AND.

## Ingest wiring

`refreshSource` loads `getSourceFilter(source)` and passes it into `fetchListings` and the match gate. `refreshSourceWith(adapter, source, filter)` is the test seam.

## Error handling

- Bad/missing config row → code default; refresh continues.
- Save rejects unknown field ids and non-string tokens; persist nothing.
- Fetch HTTP errors fail that source run (`justjoin fetch failed: 400` style).
- View filter remains pure client state.

## Testing

- Match: OR in field, AND across fields, `any`/missing pass, empty values skip the field, exclude hits title/description/tags only (not invented location).
- Each adapter’s `fetchListings` URL/body from a given `SourceFilter` (mock `fetch`).
- `matchFields` on existing fixtures (justjoin workplace + skills; himalayas categories after slug filter).
- Queries: round-trip, fallback, reset, ignore leftover `filter_config` rows.
- Refresh: edited justjoin skills/experience changes accept vs reject via `refreshSourceWith`.
- UI/unit: FiltersEditor only renders declared fields; inbox-filter has no `tracks`.

## Data flow

```text
/filters ──(save source JSON)──▶ source_filter_config
                                      │
refresh?source=justjoin ─▶ getSourceFilter(justjoin)
                                      │
                    adapter.fetchListings(filter) ── board API
                                      │
                    normalize + matchFields + exclude/required
                                      │
                    accept → upsert (jobs.track written as "-")
inbox ─ text + source toggles only
```
