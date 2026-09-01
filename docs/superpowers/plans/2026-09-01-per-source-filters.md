# Per-source filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement inline. Spec: `docs/superpowers/specs/2026-09-01-per-source-filters-design.md`.

**Goal:** Per-source fetch + field-scoped match; remove Track A/B from the product.

**Architecture:** Adapters declare `capabilities` and `matchFields`. `/filters` edits a `SourceFilter` per source. Refresh fetches with those params, then `matchesSource` on native fields. `jobs.track` is written as `"-"` and never read.

**Tech Stack:** Next.js 16, Turso/libSQL, Vitest, `@proteus-ui/core`.

## Global Constraints

- No Track / TrackFilter / FilterInput.track in app types or UI.
- Missing/`any` field values pass. Exclude is title + description + tags only.
- Catalog is code-declared. Operator edits values only.
- Do not drop `jobs.track` or `filter_config` SQL.
- Do not commit unless the operator asks.

## File map

- Create: `db/migrations/003_source_filter_config.sql`
- Modify: `src/types/job.ts`, `src/lib/filter-defaults.ts`, `src/lib/filters.ts`, `src/lib/db/queries.ts`, `src/lib/refresh.ts`, `src/lib/sources/types.ts`, all six adapters, `src/lib/inbox-filter.ts`, filters actions/page/editor, InboxFilter, InboxRow, AppliedRow
- Test: `tests/filters.test.ts`, `tests/filter-config.test.ts`, `tests/filters-actions.test.ts`, `tests/refresh.test.ts`, `tests/inbox-filter.test.ts`, `tests/adapters.test.ts`, `tests/db.test.ts`

## Tasks

1. Types + match engine + defaults + tests
2. Migration + source filter queries
3. Adapter contract + six adapters (fetch + matchFields, drop track)
4. Refresh wiring
5. /filters UI + inbox/applied track removal
6. Remaining test updates

---

Execute inline in this session. No per-task commits.
