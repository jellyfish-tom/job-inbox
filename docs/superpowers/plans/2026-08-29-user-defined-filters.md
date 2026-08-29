# User-Defined Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user define per-track accept/reject keyword rules in the UI that drive ingest filtering, and add a client-side view filter over the inbox.

**Architecture:** Replace the hardcoded logic in `src/lib/filters.ts` with a config-driven engine that evaluates a `TrackFilter` (AND-of-ORs required groups + an exclude list) against a lowercased haystack. Per-track configs are stored as JSON in a new `filter_config` table, read at ingest time, and edited on a new `/filters` page. Code-defined `DEFAULT_FILTERS` reproduce today's behavior and are the fallback when no row exists.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, `@libsql/client` (Turso), Vitest 3.

## Global Constraints

- No new runtime dependencies.
- `src/lib/auth.ts` and `src/middleware.ts` remain Web Crypto only — do not import them here.
- `SOURCE_IDS` in `src/types/job.ts` is the single source of truth for source ids.
- Ingest must never overwrite `status` / `appliedAt` / `notes` (unchanged `upsertJob` contract).
- `refreshSourceWith(adapter, source, filters)` stays the DB-free test seam; only `refreshSource` reads the DB.
- Migrations are additive and idempotent (`CREATE TABLE IF NOT EXISTS`); `scripts/migrate.mjs` applies every `db/migrations/*.sql` in filename order.
- Keyword matching is case-insensitive substring over the haystack.
- TDD: write the failing test first, then minimal code. Commit per task.

## Model phases (per model-tiering-handoff rule)

| Phase | Tasks | Tier | Model |
| --- | --- | --- | --- |
| Implementation | 1–5 | T1 | Sonnet 4.6 Medium |
| Pre-merge review | review | T2 | Opus 4.8 Medium |

Run all of Tasks 1–5 on T1 (one contiguous phase). At the handoff gate, run session-handoff and switch to T2 for the final review.

## Spec

`docs/superpowers/specs/2026-08-29-user-defined-filters-design.md`

## File Structure

- `src/types/job.ts` — add `KeywordGroup`, `TrackFilter` types (data types live with the rest).
- `src/lib/filter-defaults.ts` — new: `DEFAULT_FILTERS` and pure `sanitizeTrackFilter`.
- `src/lib/filters.ts` — engine refactor: `isInstantReject(input, filter)`, `matchesCriteria(input, filter)`.
- `db/migrations/002_filter_config.sql` — new table.
- `scripts/migrate.mjs` — run all migrations in order.
- `src/lib/db/queries.ts` — `getFilterConfig`, `getAllFilterConfigs`, `saveFilterConfig`, `resetFilterConfig`.
- `src/lib/refresh.ts` — thread `filters` through `refreshSourceWith`; `refreshSource` loads configs.
- `src/app/actions/filters.ts` — new: `saveFiltersAction`, `resetFiltersAction`.
- `src/app/filters/page.tsx` — new: settings page.
- `src/components/FiltersEditor.tsx` — new: client editor.
- `src/app/layout.tsx` — add `/filters` nav link.
- `src/lib/inbox-filter.ts` — new: pure `filterJobs` helper.
- `src/components/InboxFilter.tsx` — new: client view filter wrapping `InboxRow`.
- `src/app/page.tsx` — render `InboxFilter`.

---

### Task 1: Filter types, defaults, and config-driven engine

**Files:**
- Modify: `src/types/job.ts`
- Create: `src/lib/filter-defaults.ts`
- Modify: `src/lib/filters.ts`
- Test (replace): `tests/filters.test.ts`

**Interfaces:**
- Produces:
  - `type KeywordGroup = { label: string; keywords: string[] }`
  - `type TrackFilter = { requiredGroups: KeywordGroup[]; exclude: string[] }`
  - `DEFAULT_FILTERS: Record<Track, TrackFilter>`
  - `sanitizeTrackFilter(config: TrackFilter): TrackFilter` — trims/lowercases nothing but drops empty-string keywords/excludes and drops groups left with zero keywords.
  - `isInstantReject(input: FilterInput, filter: TrackFilter): boolean`
  - `matchesCriteria(input: FilterInput, filter: TrackFilter): boolean`

- [ ] **Step 1: Add types to `src/types/job.ts`** (append after `FilterInput`)

```ts
export type KeywordGroup = {
  label: string;
  keywords: string[];
};

export type TrackFilter = {
  requiredGroups: KeywordGroup[];
  exclude: string[];
};
```

- [ ] **Step 2: Write `src/lib/filter-defaults.ts`**

```ts
import type { Track, TrackFilter } from "@/types/job";

// Bilingual PL/EN. Polish stems exploit substring matching so one entry
// covers inflections: "zdaln" → zdalnie/zdalna/zdalny, "stacjonarn" →
// stacjonarna/stacjonarnie, "hybryd" → hybryda/hybrydowo.
const EXCLUDE = [
  "hybrid",
  "hybryd",
  "on-site",
  "onsite",
  "stacjonarn",
  "office days",
  "days in office",
  "dni w biurze",
  "w biurze",
  "us only",
  "united states only",
  "uk only",
  "pst only",
  "pt hours",
  "pacific time only",
  "3 days",
  "2 days in",
];

const REMOTE = ["remote", "fully remote", "zdaln", "w pełni zdalnie"];
const SENIORITY = ["senior", "staff", "lead", "principal", "starszy"];

export const DEFAULT_FILTERS: Record<Track, TrackFilter> = {
  A: {
    requiredGroups: [
      { label: "Remote", keywords: [...REMOTE] },
      { label: "Stack", keywords: ["react", "typescript", "frontend"] },
      { label: "Seniority", keywords: [...SENIORITY] },
    ],
    exclude: [...EXCLUDE],
  },
  B: {
    requiredGroups: [
      { label: "Stack", keywords: ["react", "typescript"] },
      { label: "Seniority", keywords: [...SENIORITY] },
      { label: "Remote", keywords: [...REMOTE] },
      { label: "Location", keywords: ["poland", "polska", "polsce", "eu remote"] },
      { label: "Contract", keywords: ["b2b", "kontrakt", "contract"] },
    ],
    exclude: [...EXCLUDE],
  },
};

export function sanitizeTrackFilter(config: TrackFilter): TrackFilter {
  const requiredGroups = config.requiredGroups
    .map((group) => ({
      label: group.label.trim(),
      keywords: group.keywords.map((k) => k.trim()).filter((k) => k !== ""),
    }))
    .filter((group) => group.keywords.length > 0);

  const exclude = config.exclude.map((k) => k.trim()).filter((k) => k !== "");

  return { requiredGroups, exclude };
}
```

- [ ] **Step 3: Rewrite `src/lib/filters.ts`**

```ts
import type { FilterInput, TrackFilter } from "@/types/job";

function haystack(input: FilterInput): string {
  return [
    input.title,
    input.company,
    input.description,
    input.location,
    input.tags.join(" "),
    input.contractType ?? "",
    input.timezone ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function isInstantReject(
  input: FilterInput,
  filter: TrackFilter,
): boolean {
  const h = haystack(input);
  return filter.exclude.some((k) => k !== "" && h.includes(k.toLowerCase()));
}

export function matchesCriteria(
  input: FilterInput,
  filter: TrackFilter,
): boolean {
  const h = haystack(input);
  return filter.requiredGroups.every((group) =>
    group.keywords.some((k) => k !== "" && h.includes(k.toLowerCase())),
  );
}
```

- [ ] **Step 4: Replace `tests/filters.test.ts`** (old compound-agency test is intentionally dropped — behavior removed per spec simplification 4)

```ts
import { expect, test } from "vitest";
import { DEFAULT_FILTERS, sanitizeTrackFilter } from "@/lib/filter-defaults";
import { isInstantReject, matchesCriteria } from "@/lib/filters";
import type { FilterInput, TrackFilter } from "@/types/job";

const baseA: FilterInput = {
  title: "Senior Frontend Engineer",
  company: "Acme",
  description: "React TypeScript fully remote CET",
  location: "European Union",
  tags: ["react", "typescript", "remote"],
  track: "A",
  contractType: null,
  timezone: "CET",
};

test("default A accepts clean remote senior FE", () => {
  expect(isInstantReject(baseA, DEFAULT_FILTERS.A)).toBe(false);
  expect(matchesCriteria(baseA, DEFAULT_FILTERS.A)).toBe(true);
});

test("default A excludes hybrid / on-site / 3 days", () => {
  expect(
    isInstantReject({ ...baseA, description: "hybrid 3 days in office" }, DEFAULT_FILTERS.A),
  ).toBe(true);
  expect(isInstantReject({ ...baseA, location: "on-site Warsaw" }, DEFAULT_FILTERS.A)).toBe(true);
});

test("default A rejects when a required group is unmet", () => {
  expect(
    matchesCriteria({ ...baseA, title: "Backend Dev", tags: ["java"], description: "Java remote" }, DEFAULT_FILTERS.A),
  ).toBe(false);
});

test("default B accepts polish b2b remote senior react", () => {
  const b: FilterInput = {
    ...baseA,
    track: "B",
    title: "React Developer",
    tags: ["react"],
    description: "senior fully remote",
    location: "Poland",
    contractType: "b2b",
  };
  expect(matchesCriteria(b, DEFAULT_FILTERS.B)).toBe(true);
  expect(matchesCriteria({ ...b, location: "European Union", description: "senior remote" }, DEFAULT_FILTERS.B)).toBe(false);
  expect(matchesCriteria({ ...b, contractType: null, description: "senior fully remote uop" }, DEFAULT_FILTERS.B)).toBe(false);
});

test("empty requiredGroups accepts everything; a group with only an exclude match rejects", () => {
  const acceptAll: TrackFilter = { requiredGroups: [], exclude: [] };
  expect(matchesCriteria({ ...baseA, title: "anything" }, acceptAll)).toBe(true);
  const excludeInterns: TrackFilter = { requiredGroups: [], exclude: ["intern"] };
  expect(isInstantReject({ ...baseA, title: "Intern" }, excludeInterns)).toBe(true);
});

test("sanitizeTrackFilter drops empty keywords and empty groups", () => {
  const dirty: TrackFilter = {
    requiredGroups: [
      { label: " Stack ", keywords: [" react ", "", "  "] },
      { label: "Empty", keywords: ["", "  "] },
    ],
    exclude: ["hybrid", "", " "],
  };
  expect(sanitizeTrackFilter(dirty)).toEqual({
    requiredGroups: [{ label: "Stack", keywords: ["react"] }],
    exclude: ["hybrid"],
  });
});
```

- [ ] **Step 5: Run tests, expect FAIL then PASS**

Run: `npm test -- filters`
Expected before Step 2–3 exist: FAIL (module/args). After: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/lib/filters.ts src/lib/filter-defaults.ts src/types/job.ts tests/filters.test.ts`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/job.ts src/lib/filter-defaults.ts src/lib/filters.ts tests/filters.test.ts
git commit -m "feat: config-driven keyword filter engine with defaults"
```

---

### Task 2: `filter_config` migration, migrate-all runner, and queries

**Files:**
- Create: `db/migrations/002_filter_config.sql`
- Modify: `scripts/migrate.mjs`
- Modify: `src/lib/db/queries.ts`
- Test: `tests/filter-config.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_FILTERS` (Task 1), `Track`, `TrackFilter`.
- Produces:
  - `getFilterConfig(track: Track): Promise<TrackFilter>` — stored row or `DEFAULT_FILTERS[track]` on missing/malformed.
  - `getAllFilterConfigs(): Promise<Record<Track, TrackFilter>>`
  - `saveFilterConfig(track: Track, config: TrackFilter): Promise<void>`
  - `resetFilterConfig(track: Track): Promise<void>`

- [ ] **Step 1: Write `db/migrations/002_filter_config.sql`**

```sql
CREATE TABLE IF NOT EXISTS filter_config (
  track TEXT PRIMARY KEY,
  config TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 1b: Make `db/migrations/001_init.sql` idempotent**

Because Step 2 makes `migrate.mjs` re-run every migration on each invocation, `001` must be safe to re-apply against an already-migrated DB. Change its three `CREATE TABLE` statements to `CREATE TABLE IF NOT EXISTS` (semantically identical on a fresh DB):

```sql
CREATE TABLE IF NOT EXISTS jobs (
```
```sql
CREATE TABLE IF NOT EXISTS job_events (
```
```sql
CREATE TABLE IF NOT EXISTS refresh_runs (
```

Leave the rest of `001_init.sql` unchanged.

- [ ] **Step 2: Generalize `scripts/migrate.mjs`**

```js
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const dir = path.join(__dirname, "../db/migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const db = createClient({ url, authToken });
for (const file of files) {
  const sql = readFileSync(path.join(dir, file), "utf8");
  await db.executeMultiple(sql);
  console.log(`Applied ${file}`);
}
console.log(`Migrated ${url}`);
```

- [ ] **Step 3: Add queries to `src/lib/db/queries.ts`**

Add imports at top (merge with existing type import line):

```ts
import { DEFAULT_FILTERS } from "@/lib/filter-defaults";
import type { JobStatus, NormalizedJob, SourceId, Track, TrackFilter } from "@/types/job";
```

Append these functions at the end of the file:

```ts
function isTrackFilter(value: unknown): value is TrackFilter {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.requiredGroups) || !Array.isArray(obj.exclude)) {
    return false;
  }
  if (!obj.exclude.every((e) => typeof e === "string")) return false;
  return obj.requiredGroups.every((group) => {
    if (typeof group !== "object" || group === null) return false;
    const g = group as Record<string, unknown>;
    return (
      typeof g.label === "string" &&
      Array.isArray(g.keywords) &&
      g.keywords.every((k) => typeof k === "string")
    );
  });
}

export async function getFilterConfig(track: Track): Promise<TrackFilter> {
  const result = await getDb().execute({
    sql: "SELECT config FROM filter_config WHERE track = ?",
    args: [track],
  });
  const raw = result.rows[0]?.config;
  if (raw == null) return DEFAULT_FILTERS[track];
  try {
    const parsed: unknown = JSON.parse(String(raw));
    return isTrackFilter(parsed) ? parsed : DEFAULT_FILTERS[track];
  } catch {
    return DEFAULT_FILTERS[track];
  }
}

export async function getAllFilterConfigs(): Promise<Record<Track, TrackFilter>> {
  const [a, b] = await Promise.all([
    getFilterConfig("A"),
    getFilterConfig("B"),
  ]);
  return { A: a, B: b };
}

export async function saveFilterConfig(
  track: Track,
  config: TrackFilter,
): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO filter_config (track, config, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(track) DO UPDATE
            SET config = excluded.config, updated_at = excluded.updated_at`,
    args: [track, JSON.stringify(config), now()],
  });
}

export async function resetFilterConfig(track: Track): Promise<void> {
  await getDb().execute({
    sql: "DELETE FROM filter_config WHERE track = ?",
    args: [track],
  });
}
```

- [ ] **Step 4: Write `tests/filter-config.test.ts`**

```ts
import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, expect, test } from "vitest";
import { getDb, resetDbClient } from "@/lib/db/client";
import { DEFAULT_FILTERS } from "@/lib/filter-defaults";
import {
  getAllFilterConfigs,
  getFilterConfig,
  resetFilterConfig,
  saveFilterConfig,
} from "@/lib/db/queries";
import type { TrackFilter } from "@/types/job";

process.env.TURSO_DATABASE_URL = "file:tests/tmp-filter-config.test.db";

const dbPath = path.join(process.cwd(), "tests/tmp-filter-config.test.db");
const migrationsDir = path.join(process.cwd(), "db/migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

beforeEach(async () => {
  resetDbClient();
  if (existsSync(dbPath)) unlinkSync(dbPath);
  for (const file of migrationFiles) {
    await getDb().executeMultiple(
      readFileSync(path.join(migrationsDir, file), "utf8"),
    );
  }
});

afterAll(() => {
  resetDbClient();
  if (existsSync(dbPath)) unlinkSync(dbPath);
});

test("missing row falls back to defaults", async () => {
  expect(await getFilterConfig("A")).toEqual(DEFAULT_FILTERS.A);
  expect(await getAllFilterConfigs()).toEqual(DEFAULT_FILTERS);
});

test("save round-trips and reset restores defaults", async () => {
  const custom: TrackFilter = {
    requiredGroups: [{ label: "Stack", keywords: ["vue"] }],
    exclude: ["intern"],
  };
  await saveFilterConfig("A", custom);
  expect(await getFilterConfig("A")).toEqual(custom);

  await resetFilterConfig("A");
  expect(await getFilterConfig("A")).toEqual(DEFAULT_FILTERS.A);
});

test("malformed row falls back to defaults", async () => {
  await getDb().execute({
    sql: `INSERT INTO filter_config (track, config, updated_at) VALUES (?, ?, ?)`,
    args: ["B", "{not json", new Date().toISOString()],
  });
  expect(await getFilterConfig("B")).toEqual(DEFAULT_FILTERS.B);
});
```

- [ ] **Step 5: Run tests, expect FAIL then PASS**

Run: `npm test -- filter-config`
Expected before Step 3: FAIL. After: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/lib/db/queries.ts scripts/migrate.mjs tests/filter-config.test.ts`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/002_filter_config.sql scripts/migrate.mjs src/lib/db/queries.ts tests/filter-config.test.ts
git commit -m "feat: filter_config table, migrate-all runner, and config queries"
```

---

### Task 3: Wire ingest to per-track configs

**Files:**
- Modify: `src/lib/refresh.ts`
- Modify: `tests/refresh.test.ts`

**Interfaces:**
- Consumes: `isInstantReject(input, filter)`, `matchesCriteria(input, filter)` (Task 1); `getAllFilterConfigs` (Task 2); `DEFAULT_FILTERS`.
- Produces: `refreshSourceWith(adapter, source, filters: Record<Track, TrackFilter>): Promise<RefreshResult>`.

- [ ] **Step 1: Update imports in `src/lib/refresh.ts`**

```ts
import {
  createRefreshRun,
  finishRefreshRun,
  getAllFilterConfigs,
  getJobBySourceExternalId,
  getWatermark,
  upsertJob,
} from "@/lib/db/queries";
import type {
  FilterInput,
  NormalizedJob,
  SourceId,
  Track,
  TrackFilter,
} from "@/types/job";
```

- [ ] **Step 2: Add `filters` param to `refreshSourceWith` signature**

Change:

```ts
export async function refreshSourceWith(
  adapter: SourceAdapter,
  source: SourceId,
  filters: Record<Track, TrackFilter>,
): Promise<RefreshResult> {
```

- [ ] **Step 3: Use the per-track filter in the reject check**

Replace the `if (!existing) { ... }` reject block body:

```ts
      if (!existing) {
        const filterInput = buildFilterInput(job);
        const filter = filters[job.track];
        if (
          isInstantReject(filterInput, filter) ||
          !matchesCriteria(filterInput, filter)
        ) {
          rejected++;
          continue;
        }

        if (isOlderThanWatermark(job.postedAt, watermark)) {
          skipped++;
          continue;
        }
      }
```

- [ ] **Step 4: Load configs in `refreshSource`**

```ts
export async function refreshSource(source: SourceId): Promise<RefreshResult> {
  const filters = await getAllFilterConfigs();
  return refreshSourceWith(getAdapter(source), source, filters);
}
```

- [ ] **Step 5: Update `tests/refresh.test.ts` to pass filters**

Add import:

```ts
import { DEFAULT_FILTERS } from "@/lib/filter-defaults";
```

Update the three call sites to pass `DEFAULT_FILTERS`:

```ts
const result = await refreshSourceWith(adapter, "remoteok", DEFAULT_FILTERS);
```
```ts
await refreshSourceWith(adapter, "remoteok", DEFAULT_FILTERS);
```
```ts
await refreshSourceWith(adapter2, "remoteok", DEFAULT_FILTERS);
```
```ts
const result = await refreshSourceWith(adapter, "remoteok", DEFAULT_FILTERS);
```

Append a test proving configs drive the decision:

```ts
test("custom accept-all filter keeps a job the default would reject", async () => {
  const acceptAll = {
    A: { requiredGroups: [], exclude: [] },
    B: { requiredGroups: [], exclude: [] },
  };
  const adapter = {
    source: "remoteok" as const,
    fetchListings: async () => [hybridRaw],
    normalize: () => hybridJob(),
  };
  const result = await refreshSourceWith(adapter, "remoteok", acceptAll);
  expect(result.status).toBe("ok");
  expect(result.inserted).toBe(1);
  expect(result.rejected).toBe(0);
});
```

- [ ] **Step 6: Run tests, expect PASS**

Run: `npm test -- refresh`
Expected: PASS (all, including new test).

- [ ] **Step 7: Typecheck + lint**

Run: `npm run typecheck && npx eslint src/lib/refresh.ts tests/refresh.test.ts`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/refresh.ts tests/refresh.test.ts
git commit -m "feat: drive ingest filtering from per-track config"
```

---

### Task 4: `/filters` settings page, editor, and server actions

**Files:**
- Create: `src/app/actions/filters.ts`
- Create: `src/components/FiltersEditor.tsx`
- Create: `src/app/filters/page.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/filters-actions.test.ts`

**Interfaces:**
- Consumes: `getAllFilterConfigs`, `saveFilterConfig`, `resetFilterConfig` (Task 2); `sanitizeTrackFilter` (Task 1); `Track`, `TrackFilter`.
- Produces:
  - `saveFiltersAction(track: Track, config: TrackFilter): Promise<void>`
  - `resetFiltersAction(track: Track): Promise<void>`

- [ ] **Step 1: Write `src/app/actions/filters.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { resetFilterConfig, saveFilterConfig } from "@/lib/db/queries";
import { sanitizeTrackFilter } from "@/lib/filter-defaults";
import type { Track, TrackFilter } from "@/types/job";

export async function saveFiltersAction(
  track: Track,
  config: TrackFilter,
): Promise<void> {
  await saveFilterConfig(track, sanitizeTrackFilter(config));
  revalidatePath("/filters");
}

export async function resetFiltersAction(track: Track): Promise<void> {
  await resetFilterConfig(track);
  revalidatePath("/filters");
}
```

- [ ] **Step 2: Write `tests/filters-actions.test.ts`** (exercises the sanitize contract the action relies on — pure, no server runtime)

```ts
import { expect, test } from "vitest";
import { sanitizeTrackFilter } from "@/lib/filter-defaults";
import type { TrackFilter } from "@/types/job";

test("save path sanitizes: empty group removed, blanks trimmed", () => {
  const input: TrackFilter = {
    requiredGroups: [
      { label: "Stack", keywords: ["React", " ", ""] },
      { label: "Blank", keywords: [""] },
    ],
    exclude: [" hybrid ", ""],
  };
  expect(sanitizeTrackFilter(input)).toEqual({
    requiredGroups: [{ label: "Stack", keywords: ["React"] }],
    exclude: ["hybrid"],
  });
});

test("removing all groups yields accept-all config", () => {
  const input: TrackFilter = { requiredGroups: [], exclude: [] };
  expect(sanitizeTrackFilter(input)).toEqual({ requiredGroups: [], exclude: [] });
});
```

- [ ] **Step 3: Write `src/components/FiltersEditor.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { resetFiltersAction, saveFiltersAction } from "@/app/actions/filters";
import { DEFAULT_FILTERS } from "@/lib/filter-defaults";
import type { Track, TrackFilter } from "@/types/job";

export function FiltersEditor({
  track,
  initial,
}: {
  track: Track;
  initial: TrackFilter;
}) {
  const [config, setConfig] = useState<TrackFilter>(initial);
  const [pending, startTransition] = useTransition();

  function updateGroupLabel(index: number, label: string) {
    setConfig((c) => {
      const requiredGroups = c.requiredGroups.map((g, i) =>
        i === index ? { ...g, label } : g,
      );
      return { ...c, requiredGroups };
    });
  }

  function updateGroupKeywords(index: number, text: string) {
    const keywords = text.split(/[,\n]+/).map((k) => k.trim());
    setConfig((c) => {
      const requiredGroups = c.requiredGroups.map((g, i) =>
        i === index ? { ...g, keywords } : g,
      );
      return { ...c, requiredGroups };
    });
  }

  function addGroup() {
    setConfig((c) => ({
      ...c,
      requiredGroups: [...c.requiredGroups, { label: "New group", keywords: [] }],
    }));
  }

  function removeGroup(index: number) {
    setConfig((c) => ({
      ...c,
      requiredGroups: c.requiredGroups.filter((_, i) => i !== index),
    }));
  }

  function updateExclude(text: string) {
    const exclude = text.split(/[,\n]+/).map((k) => k.trim());
    setConfig((c) => ({ ...c, exclude }));
  }

  return (
    <section className="filters-track">
      <h2>Track {track}</h2>

      <p className="filters-hint">
        A job is kept when it matches at least one keyword in every group and no
        exclude keyword. Keywords are comma-separated, case-insensitive.
      </p>

      {config.requiredGroups.map((group, index) => (
        <div key={index} className="filters-group">
          <input
            aria-label={`Track ${track} group ${index + 1} label`}
            value={group.label}
            onChange={(e) => updateGroupLabel(index, e.target.value)}
          />
          <textarea
            aria-label={`Track ${track} group ${index + 1} keywords`}
            value={group.keywords.join(", ")}
            onChange={(e) => updateGroupKeywords(index, e.target.value)}
          />
          <button type="button" onClick={() => removeGroup(index)}>
            Remove group
          </button>
        </div>
      ))}

      <button type="button" onClick={addGroup}>
        Add group
      </button>

      <label className="filters-exclude">
        Exclude
        <textarea
          aria-label={`Track ${track} exclude`}
          value={config.exclude.join(", ")}
          onChange={(e) => updateExclude(e.target.value)}
        />
      </label>

      <div className="filters-actions">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void saveFiltersAction(track, config);
            })
          }
        >
          Save
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setConfig(DEFAULT_FILTERS[track]);
            startTransition(() => {
              void resetFiltersAction(track);
            });
          }}
        >
          Reset to defaults
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write `src/app/filters/page.tsx`**

```tsx
import { FiltersEditor } from "@/components/FiltersEditor";
import { getAllFilterConfigs } from "@/lib/db/queries";

export default async function FiltersPage() {
  let configs;
  try {
    configs = await getAllFilterConfigs();
  } catch {
    return <p>Database unavailable.</p>;
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Filters</h1>
      </header>
      <FiltersEditor track="A" initial={configs.A} />
      <FiltersEditor track="B" initial={configs.B} />
    </main>
  );
}
```

- [ ] **Step 5: Add nav link in `src/app/layout.tsx`**

Change the nav links block:

```tsx
        <nav className="site-nav">
          <Link href="/">Inbox</Link>
          <Link href="/applied">Applied</Link>
          <Link href="/filters">Filters</Link>
          <form action={logout}>
            <button type="submit">Logout</button>
          </form>
        </nav>
```

- [ ] **Step 6: Run tests, typecheck, lint, build**

Run: `npm test -- filters-actions && npm run typecheck && npx eslint src/app/actions/filters.ts src/components/FiltersEditor.tsx src/app/filters/page.tsx src/app/layout.tsx tests/filters-actions.test.ts`
Expected: tests PASS, 0 lint errors.

Run: `npm run build`
Expected: Compiled successfully (a prerender DB error on data pages without `TURSO_DATABASE_URL` is pre-existing and unrelated).

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/filters.ts src/components/FiltersEditor.tsx src/app/filters/page.tsx src/app/layout.tsx tests/filters-actions.test.ts
git commit -m "feat: /filters settings page with editable keyword rules"
```

---

### Task 5: Client view filter on the inbox

**Files:**
- Create: `src/lib/inbox-filter.ts`
- Create: `src/components/InboxFilter.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/inbox-filter.test.ts`

**Interfaces:**
- Consumes: `JobRow` (`src/lib/db/queries`), `SOURCE_IDS`, `SourceId`, `Track`.
- Produces: `filterJobs(jobs: JobRow[], q: ViewQuery): JobRow[]` where `ViewQuery = { text: string; sources: SourceId[]; tracks: Track[] }`.

- [ ] **Step 1: Write `src/lib/inbox-filter.ts`**

```ts
import type { JobRow } from "@/lib/db/queries";
import type { SourceId, Track } from "@/types/job";

export type ViewQuery = {
  text: string;
  sources: SourceId[];
  tracks: Track[];
};

function jobText(job: JobRow): string {
  return [job.title, job.company, ...job.hardRequired, ...job.hardNice]
    .join(" ")
    .toLowerCase();
}

export function filterJobs(jobs: JobRow[], query: ViewQuery): JobRow[] {
  const text = query.text.trim().toLowerCase();
  return jobs.filter((job) => {
    if (query.sources.length > 0 && !query.sources.includes(job.source)) {
      return false;
    }
    if (query.tracks.length > 0 && !query.tracks.includes(job.track)) {
      return false;
    }
    if (text !== "" && !jobText(job).includes(text)) return false;
    return true;
  });
}
```

- [ ] **Step 2: Write `tests/inbox-filter.test.ts`**

```ts
import { expect, test } from "vitest";
import type { JobRow } from "@/lib/db/queries";
import { filterJobs } from "@/lib/inbox-filter";

function row(overrides: Partial<JobRow>): JobRow {
  return {
    id: "1",
    source: "remoteok",
    externalId: "e1",
    url: "https://x/1",
    title: "Senior React Engineer",
    company: "Acme",
    track: "A",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryRaw: null,
    hardRequired: ["typescript"],
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: "{}",
    postedAt: null,
    status: "new",
    appliedAt: null,
    notes: "",
    firstSeenAt: "2026-08-29T00:00:00.000Z",
    lastSeenAt: "2026-08-29T00:00:00.000Z",
    ...overrides,
  };
}

const jobs: JobRow[] = [
  row({ id: "1", source: "remoteok", track: "A", title: "Senior React Engineer" }),
  row({ id: "2", source: "justjoin", track: "B", title: "Vue Developer", hardRequired: ["vue"] }),
  row({ id: "3", source: "wwr", track: "A", title: "Staff Frontend", company: "Globex" }),
];

test("empty query returns all", () => {
  expect(filterJobs(jobs, { text: "", sources: [], tracks: [] })).toHaveLength(3);
});

test("text matches title, company, and tags", () => {
  expect(filterJobs(jobs, { text: "react", sources: [], tracks: [] }).map((j) => j.id)).toEqual(["1"]);
  expect(filterJobs(jobs, { text: "globex", sources: [], tracks: [] }).map((j) => j.id)).toEqual(["3"]);
  expect(filterJobs(jobs, { text: "vue", sources: [], tracks: [] }).map((j) => j.id)).toEqual(["2"]);
});

test("source and track filters combine (AND)", () => {
  expect(filterJobs(jobs, { text: "", sources: ["justjoin"], tracks: [] }).map((j) => j.id)).toEqual(["2"]);
  expect(filterJobs(jobs, { text: "", sources: [], tracks: ["A"] }).map((j) => j.id)).toEqual(["1", "3"]);
  expect(filterJobs(jobs, { text: "", sources: ["remoteok"], tracks: ["B"] })).toHaveLength(0);
});
```

- [ ] **Step 3: Write `src/components/InboxFilter.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { InboxRow } from "@/components/InboxRow";
import type { JobRow } from "@/lib/db/queries";
import { filterJobs } from "@/lib/inbox-filter";
import { SOURCE_IDS, type SourceId, type Track } from "@/types/job";

const TRACKS: Track[] = ["A", "B"];

export function InboxFilter({ jobs }: { jobs: JobRow[] }) {
  const [text, setText] = useState("");
  const [sources, setSources] = useState<SourceId[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);

  const filtered = useMemo(
    () => filterJobs(jobs, { text, sources, tracks }),
    [jobs, text, sources, tracks],
  );

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  return (
    <>
      <div className="inbox-filter">
        <input
          type="search"
          placeholder="Search title, company, skills"
          aria-label="Search inbox"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="inbox-filter-toggles" aria-label="Source filters">
          {SOURCE_IDS.map((source) => (
            <label key={source}>
              <input
                type="checkbox"
                checked={sources.includes(source)}
                onChange={() => setSources((s) => toggle(s, source))}
              />
              {source}
            </label>
          ))}
        </div>
        <div className="inbox-filter-toggles" aria-label="Track filters">
          {TRACKS.map((track) => (
            <label key={track}>
              <input
                type="checkbox"
                checked={tracks.includes(track)}
                onChange={() => setTracks((t) => toggle(t, track))}
              />
              Track {track}
            </label>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No jobs match.</p>
      ) : (
        <ul className="job-list">
          {filtered.map((job) => (
            <li key={job.id}>
              <InboxRow job={job} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 4: Render `InboxFilter` in `src/app/page.tsx`**

Add import:

```tsx
import { InboxFilter } from "@/components/InboxFilter";
```

Replace the `{jobs.length === 0 ? (...) : (...)}` block with:

```tsx
      {jobs.length === 0 ? (
        <p className="empty-state">No jobs in inbox.</p>
      ) : (
        <InboxFilter jobs={jobs} />
      )}
```

Remove the now-unused `InboxRow` import from `src/app/page.tsx` (it moved into `InboxFilter`).

- [ ] **Step 5: Run tests, typecheck, lint, build**

Run: `npm test -- inbox-filter && npm run typecheck && npx eslint src/lib/inbox-filter.ts src/components/InboxFilter.tsx src/app/page.tsx tests/inbox-filter.test.ts`
Expected: tests PASS, 0 lint errors.

Run: `npm run build`
Expected: Compiled successfully.

- [ ] **Step 6: Commit**

```bash
git add src/lib/inbox-filter.ts src/components/InboxFilter.tsx src/app/page.tsx tests/inbox-filter.test.ts
git commit -m "feat: client-side inbox view filter"
```

---

## Final verification (end of Task 5)

- [ ] Run full suite: `npm test` — expected all green.
- [ ] `npm run typecheck` — clean.
- [ ] `npx eslint src tests` — 0 errors/0 warnings.
- [ ] Apply migration locally: `node scripts/migrate.mjs` against `TURSO_DATABASE_URL` — expected "Applied 001_init.sql", "Applied 002_filter_config.sql".
- [ ] Manual smoke: `/filters` edits persist across reload; "Reset to defaults" restores; a refresh honors edited rules; inbox search/toggles filter the list.

## Self-Review

**Spec coverage:**
- Persisted per-track keyword config → Task 2 (`filter_config`, queries).
- `/filters` settings page with editable groups + exclude + reset → Task 4.
- Config-driven `filters.ts` (AND-of-ORs + exclude, haystack incl. `contractType`) → Task 1.
- Ingest reads config per run → Task 3.
- Client-side view filter (text + source/track) → Task 5.
- Defaults in one module, fallback on missing/malformed → Tasks 1 + 2.
- Migration additive + migrate-all runner → Task 2.
- Behavior simplifications 1–4 (Track A title shortcuts, regexes→literals, contractType→haystack group, drop compound agency rule) → encoded in `DEFAULT_FILTERS` (Task 1); old compound-agency test removed.

**Type consistency:** `TrackFilter`/`KeywordGroup` defined in Task 1 and used identically in Tasks 2–5. `Record<Track, TrackFilter>` used by `getAllFilterConfigs` (Task 2) and `refreshSourceWith`/`refreshSource` (Task 3). `ViewQuery` defined and consumed only in Task 5.

**Placeholder scan:** none — every code step is complete.
