# Thermo-Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every finding (blockers and minors) from the 2026-08-29 thermo-nuclear code quality review (`.superpowers/sdd/thermo-review.md`) without changing user-visible behavior, except where the review identified silent correctness bugs in filtering.

**Architecture:** Behavior-preserving restructurings: move filter fields into `NormalizedJob` so the shared refresh layer stops parsing `rawJson`; collapse session auth to a single Web Crypto module; derive the source list from one const; single SELECT per listing in the refresh loop; plain trailing debounce in `AppliedRow`; typed DB errors instead of message regex; URL validity enforced at the adapter boundary.

**Tech Stack:** Next.js 16.2.6 (App Router, Edge middleware), TypeScript 5, @libsql/client 0.15, Vitest 3.

## Global Constraints

- All 31 existing tests must stay green after every task; new tests are added where noted.
- Verification gate per task: `npm test` && `npm run typecheck` && `npm run lint` (lint must end with **0 errors, 0 warnings** after Task 8).
- No new dependencies. No new npm scripts.
- Fetch must never overwrite `status` / `appliedAt` / `notes` (existing invariant, guarded by `tests/refresh.test.ts` "second fetch does not clobber applied notes").
- `refreshSourceWith(adapter, source)` stays exported as the test seam.
- Conventional commit per task. Do not push.

## Model phases (per model-tiering-handoff rule)

| Phase | Tasks | Tier | Model | Notes |
| --- | --- | --- | --- | --- |
| A — mechanical cleanups | 1–2 | T0 | Composer 2.5 | **completed** |
| B — structural fixes | 3–8 | T1 | Sonnet 4.6 Medium | New tests + cross-file restructuring |
| C — pre-merge review | (existing plan Task 11) | T2 | Opus 4.8 Medium | Folds into `2026-08-29-job-inbox.md` Phase 4 |

At each phase gate: run session-handoff skill, update this frontmatter, stop, and tell the operator to switch models. After 2 failed attempts on the same error class, escalate one tier.

---

## Phase A (T0 — Composer 2.5)

### Task 1: Mechanical cleanups — gitignore, url no-op, eventStatement reuse, pickArray

Review findings: §6–7 repo hygiene + no-op line, §4.2 `eventStatement` ignored by its own file, §4.3 `extractOffers`/`extractPostings` copy-paste.

**Files:**
- Modify: `.gitignore`
- Modify: `src/lib/url.ts:6-8`
- Modify: `src/lib/db/queries.ts:295-341`
- Create: `src/lib/sources/parse.ts`
- Modify: `src/lib/sources/justjoin.ts:21-34,80`
- Modify: `src/lib/sources/nofluff.ts:15-28,74`

**Interfaces:**
- Produces: `pickArray(data: unknown, keys: string[]): unknown[]` in `src/lib/sources/parse.ts` (used by justjoin, nofluff, and any future wrapped-array source).

- [x] **Step 1: Add `tsconfig.tsbuildinfo` to `.gitignore`**

Append one line to `.gitignore`:

```gitignore
tsconfig.tsbuildinfo
```

- [x] **Step 2: Delete the no-op line in `src/lib/url.ts`**

Replace lines 6–8:

```ts
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "";
  return `${u.protocol}//${u.host}${path}`;
```

with:

```ts
  const path = u.pathname.replace(/\/+$/, "");
  return `${u.protocol}//${u.host}${path}`;
```

- [x] **Step 3: Reuse `eventStatement` in `applyJob`, `rejectJob`, `updateNotes`**

In `src/lib/db/queries.ts`, the three functions at lines 295–341 each inline the `INSERT INTO job_events` SQL that `eventStatement` (line 131) already produces. Replace each inline event insert with the helper. Note: `eventStatement` calls `now()` internally, so the event `at` may differ from the row `ts` by a millisecond — acceptable, no test depends on them matching.

```ts
export async function applyJob(id: string): Promise<void> {
  const ts = now();
  await getDb().batch([
    {
      sql: `UPDATE jobs
            SET status = 'applied',
                applied_at = COALESCE(applied_at, ?)
            WHERE id = ?`,
      args: [ts, id],
    },
    eventStatement(id, "applied", "user"),
  ]);
}

export async function rejectJob(id: string): Promise<void> {
  await getDb().batch([
    {
      sql: "UPDATE jobs SET status = 'rejected' WHERE id = ?",
      args: [id],
    },
    eventStatement(id, "rejected", "user"),
  ]);
}

export async function updateNotes(id: string, notes: string): Promise<void> {
  await getDb().batch([
    {
      sql: "UPDATE jobs SET notes = ? WHERE id = ?",
      args: [notes, id],
    },
    eventStatement(id, "notes_updated", "user"),
  ]);
}
```

(`rejectJob` and `updateNotes` no longer need their local `ts`.)

- [x] **Step 4: Extract `pickArray` shared helper**

Create `src/lib/sources/parse.ts`:

```ts
export function pickArray(data: unknown, keys: string[]): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }
  return [];
}
```

In `src/lib/sources/justjoin.ts`: delete `extractOffers` (lines 21–34), add `import { pickArray } from "./parse";` at top, and in `fetchListings` replace `return extractOffers(await res.json());` with:

```ts
    return pickArray(await res.json(), ["data", "offers", "items"]);
```

In `src/lib/sources/nofluff.ts`: delete `extractPostings` (lines 15–28), add the same import, and replace `return extractPostings(await res.json());` with:

```ts
    return pickArray(await res.json(), ["postings", "data", "items"]);
```

- [x] **Step 5: Verify green**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 31 tests pass, tsc clean, lint reports only the 2 pre-existing `AppliedRow.tsx` warnings (removed in Task 8).

- [x] **Step 6: Commit**

```bash
git add .gitignore src/lib/url.ts src/lib/db/queries.ts src/lib/sources/parse.ts src/lib/sources/justjoin.ts src/lib/sources/nofluff.ts
git commit -m "refactor: reuse eventStatement and extract pickArray helper"
```

---

### Task 2: Single source of truth for the source list

Review finding §2.1 — the source list exists in `types/job.ts`, `refresh-http.ts`, `RefreshBanner.tsx`, and `registry.ts`; only the registry is compiler-enforced.

**Files:**
- Modify: `src/types/job.ts:1-7`
- Modify: `src/lib/refresh-http.ts:7-18`
- Modify: `src/components/RefreshBanner.tsx:5-14`

**Interfaces:**
- Produces: `export const SOURCE_IDS: readonly SourceId[]` in `src/types/job.ts` (display order preserved from `RefreshBanner`). `SourceId` is now derived from it — all existing `SourceId` consumers compile unchanged.

- [x] **Step 1: Derive `SourceId` from a const array**

In `src/types/job.ts`, replace lines 1–7:

```ts
export type SourceId =
  | "jungle"
  | "himalayas"
  | "wwr"
  | "justjoin"
  | "nofluff"
  | "remoteok";
```

with (order matches the current `RefreshBanner` display order):

```ts
export const SOURCE_IDS = [
  "himalayas",
  "wwr",
  "remoteok",
  "jungle",
  "justjoin",
  "nofluff",
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];
```

Do NOT derive from `registry.ts` — that would pull adapter fetch code into the client bundle via `RefreshBanner`.

- [x] **Step 2: Use it in `parseSourceParam`**

Replace the whole body of `src/lib/refresh-http.ts`:

```ts
import { SOURCE_IDS } from "@/types/job";
import type { SourceId } from "@/types/job";

export function authorizeRefresh(header: string | null, secret: string): boolean {
  return header === `Bearer ${secret}`;
}

export function parseSourceParam(value: string | null): SourceId | null {
  if (value && (SOURCE_IDS as readonly string[]).includes(value)) {
    return value as SourceId;
  }
  return null;
}
```

- [x] **Step 3: Use it in `RefreshBanner`**

In `src/components/RefreshBanner.tsx`, delete the local `SOURCES` array (lines 7–14) and the now-unused `import type { SourceId }`. Change the import to:

```ts
import { SOURCE_IDS } from "@/types/job";
```

and change the map at line 23 to `{SOURCE_IDS.map((source) => {`.

- [x] **Step 4: Verify green**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 31 tests pass (`api-refresh.test.ts` exercises `parseSourceParam`), tsc clean.

- [x] **Step 5: Commit**

```bash
git add src/types/job.ts src/lib/refresh-http.ts src/components/RefreshBanner.tsx
git commit -m "refactor: derive SourceId from single SOURCE_IDS const"
```

---

**PHASE GATE A→B:** run session-handoff skill, mark Phase A completed here, stop, and tell the operator: switch model to Sonnet 4.6 Medium, new chat, continue with Task 3.

---

## Phase B (T1 — Sonnet 4.6 Medium)

### Task 3: Unify session auth on one Web Crypto module

Review finding §1.2 — the Node-crypto `verifySession` in `auth.ts` is dead in production; middleware runs its own Web Crypto copy; the "pinning" test only checks `auth.ts` against itself.

**Files:**
- Modify: `src/lib/auth.ts` (full rewrite, ~55 lines)
- Modify: `src/middleware.ts:1-75`
- Modify: `src/app/login/actions.ts:16`
- Test: `tests/auth.test.ts` (full rewrite)

**Interfaces:**
- Produces: `signSession(nowMs?: number): Promise<string>` and `verifySession(token: string, nowMs?: number): Promise<boolean>` — **now async**. `COOKIE` and `passwordOk` unchanged. `src/lib/auth.ts` contains no `node:` imports after this task, so the Edge middleware can import it directly.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Rewrite the failing test first**

Replace `tests/auth.test.ts` entirely. The roundtrip tests go async; the pinning test now cross-checks the Web Crypto implementation against an independent `node:crypto` reference — the guarantee the old comment claimed but never asserted:

```ts
import { createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { passwordOk, signSession, verifySession } from "@/lib/auth";

process.env.SESSION_SECRET = "test-secret";
process.env.APP_PASSWORD = "secret";

test("sign/verify roundtrip", async () => {
  const t = await signSession(1_700_000_000_000);
  expect(await verifySession(t, 1_700_000_000_000)).toBe(true);
});

test("expired token fails", async () => {
  const t = await signSession(1_000);
  expect(await verifySession(t, 1_000 + 31 * 24 * 60 * 60 * 1000)).toBe(false);
});

test("tampered token fails", async () => {
  const t = await signSession(1_700_000_000_000);
  expect(await verifySession(t.slice(0, -2) + "ff", 1_700_000_000_000)).toBe(false);
});

test("passwordOk", () => {
  expect(passwordOk("secret")).toBe(true);
  expect(passwordOk("nope")).toBe(false);
});

test("token HMAC matches independent node:crypto reference", async () => {
  const nowMs = 1_700_000_000_000;
  const token = await signSession(nowMs);
  const expMs = String(nowMs + 30 * 24 * 60 * 60 * 1000);
  const expected = createHmac("sha256", "test-secret").update(expMs).digest("hex");
  expect(token).toBe(`${expMs}.${expected}`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/auth.test.ts`
Expected: FAIL — `signSession` currently returns `string`, not a promise; `await verifySession(...)` type/behavior mismatch.

- [ ] **Step 3: Rewrite `src/lib/auth.ts` on Web Crypto only**

`crypto.subtle` is available in both the Edge runtime and Node ≥ 18, so one module serves middleware, server actions, and tests. Full replacement:

```ts
export const COOKIE = "inbox_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret ? secret : null;
}

async function sessionHmac(expMs: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(expMs),
  );
  return Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signSession(nowMs: number = Date.now()): Promise<string> {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  const expMs = (nowMs + SESSION_TTL_MS).toString();
  return `${expMs}.${await sessionHmac(expMs, secret)}`;
}

export async function verifySession(
  token: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;

  const expMsStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const secret = sessionSecret();
  if (!secret) return false;

  const expMs = Number(expMsStr);
  if (!Number.isFinite(expMs) || expMs <= nowMs) return false;

  return hexEqual(sig, await sessionHmac(expMsStr, secret));
}

export function passwordOk(password: string): boolean {
  return password === process.env.APP_PASSWORD;
}
```

- [ ] **Step 4: Delete the middleware duplicate**

Replace `src/middleware.ts` entirely — `verifySessionEdge`, `hexEqual`, and the local `COOKIE` const all disappear:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/refresh"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (token && (await verifySession(token))) {
    return NextResponse.next();
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

(The missing-secret case is now handled inside `verifySession`, which returns false.)

- [ ] **Step 5: Await `signSession` in the login action**

In `src/app/login/actions.ts` line 16, change:

```ts
  cookieStore.set(COOKIE, signSession(), {
```

to:

```ts
  cookieStore.set(COOKIE, await signSession(), {
```

- [ ] **Step 6: Verify green + Edge bundle check**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 32 tests pass.
Then run: `npm run build`
Expected: build succeeds — proves the middleware Edge bundle tolerates importing `@/lib/auth` (no `node:` imports remain in it).

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/middleware.ts src/app/login/actions.ts tests/auth.test.ts
git commit -m "refactor: unify session auth on single Web Crypto module"
```

---

### Task 4: Move filter fields into `NormalizedJob`; make `buildFilterInput` a projection

Review finding §1.1 (top blocker) — `buildFilterInput` re-parses `rawJson` with source-specific magic keys, so most sources filter against empty description/location. The adapters own the source shapes; they must populate the filter fields.

**Files:**
- Modify: `src/types/job.ts` (NormalizedJob)
- Modify: `src/lib/db/queries.ts:6-13` (JobRow)
- Modify: `src/lib/refresh.ts:24-57`
- Modify: `src/lib/sources/himalayas.ts`, `src/lib/sources/wwr.ts`, `src/lib/sources/jungle.ts`, `src/lib/sources/justjoin.ts`, `src/lib/sources/nofluff.ts`, `src/lib/sources/remoteok.ts`
- Test: `tests/adapters.test.ts`, `tests/refresh.test.ts`, `tests/db.test.ts`

**Interfaces:**
- Produces: `NormalizedJob` gains `description: string`, `location: string`, `contractType: string | null`. `JobRow` becomes `Omit<NormalizedJob, "description" | "location" | "contractType"> & {...}` (these fields are filter-time only, not persisted). Every `SourceAdapter.normalize` must populate them.
- Consumes: nothing from other tasks (independent of Tasks 3, 5–8).

- [ ] **Step 1: Write the failing adapter tests**

Add to `tests/adapters.test.ts` (fixtures already carry the raw fields — himalayas has `description` + `locationRestrictions`, remoteok has `description`, justjoin has `workplaceType` + `employmentTypes[0].type`, wwr RSS has `<description>`):

```ts
test("himalayas populates filter fields from description and locationRestrictions", () => {
  const job = normalizeHimalayas(JSON.parse(fx("himalayas-one.json")));
  expect(job.description).toBe("React TypeScript remote");
  expect(job.location).toBe("Poland Germany");
  expect(job.contractType).toBeNull();
});

test("remoteok populates description", () => {
  const job = normalizeRemoteok(JSON.parse(fx("remoteok-one.json")));
  expect(job.description).toBe("React TypeScript");
});

test("wwr populates description from RSS body", () => {
  const items = parseRssItems(fx("wwr-sample.xml"));
  expect(normalizeWwr(items[0]).description).toBe("React TypeScript remote CET");
});

test("justjoin maps workplaceType and contract into filter fields", () => {
  const job = normalizeJustjoin(JSON.parse(fx("justjoin-one.json")));
  expect(job.location).toBe("remote Poland");
  expect(job.contractType).toBe("b2b");
});

test("nofluff marks fully-remote Polish listings", () => {
  const job = normalizeNofluff(JSON.parse(fx("nofluff-one.json")));
  expect(job.location).toBe("remote Poland");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/adapters.test.ts`
Expected: FAIL — `description`/`location`/`contractType` are `undefined` on the returned objects (and typecheck would reject them).

- [ ] **Step 3: Extend `NormalizedJob` and shrink `JobRow`**

In `src/types/job.ts`, add three fields to `NormalizedJob` after `track`:

```ts
export type NormalizedJob = {
  source: SourceId;
  externalId: string;
  url: string;
  title: string;
  company: string;
  track: Track;
  description: string;
  location: string;
  contractType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryRaw: string | null;
  hardRequired: string[];
  hardNice: string[];
  softRequired: string[];
  softNice: string[];
  rawJson: string;
  postedAt: string | null;
};
```

In `src/lib/db/queries.ts` lines 6–13, the DB does not persist these filter-time fields, so exclude them from the row type (`mapJobRow` then compiles unchanged):

```ts
export type JobRow = Omit<
  NormalizedJob,
  "description" | "location" | "contractType"
> & {
  id: string;
  status: JobStatus;
  appliedAt: string | null;
  notes: string;
  firstSeenAt: string;
  lastSeenAt: string;
};
```

- [ ] **Step 4: Populate the fields in every adapter**

`src/lib/sources/himalayas.ts` — extend the raw type and normalize:

```ts
type HimalayasRaw = {
  title?: string;
  companyName?: string;
  guid?: string;
  applicationLink?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  categories?: string[];
  description?: string;
  locationRestrictions?: string[];
  pubDate?: string;
};
```

and in the returned object (after `track: "A",`):

```ts
    description: item.description ?? "",
    location: (item.locationRestrictions ?? []).join(" "),
    contractType: null,
```

`src/lib/sources/wwr.ts` — `RssItem` already has `description`; add after `track: "A",`:

```ts
    description: item.description,
    location: "",
    contractType: null,
```

`src/lib/sources/remoteok.ts` — add `description?: string; location?: string;` to `RemoteokRaw`, then after `track: "A",`:

```ts
    description: item.description ?? "",
    location: item.location ?? "",
    contractType: null,
```

`src/lib/sources/jungle.ts` — add `description?: string;` and `jobLocationType?: string;` to `JobPostingLd`, add `description?: string;` and `workplace_type?: string;` to `JungleRaw`, extend `toJungleRaw`'s return with:

```ts
    description: posting.description,
    workplace_type: posting.jobLocationType,
```

and in `normalize`, after `track: "A",`:

```ts
    description: item.description ?? "",
    location: item.workplace_type ?? "",
    contractType: item.contract_type ?? null,
```

`src/lib/sources/justjoin.ts` — add `workplaceType?: string;` to `JustjoinRaw`, then after `track: "B",` (justjoin.it serves the Polish market, so listings carry the Poland market context Track B filters on):

```ts
    description: "",
    location: [item.workplaceType ?? "", "Poland"].join(" ").trim(),
    contractType: employment?.type ?? null,
```

`src/lib/sources/nofluff.ts` — add `remote?: string;` to `NofluffRaw`, then after `track: "B",` (nofluffjobs.com serves the Polish market; `remote: "fully"` marks fully-remote listings):

```ts
    description: "",
    location: item.remote === "fully" ? "remote Poland" : "Poland",
    contractType: null,
```

- [ ] **Step 5: Reduce `buildFilterInput` to a projection**

In `src/lib/refresh.ts`, replace the whole function (lines 24–57) — the `JSON.parse` re-entry and its catch disappear:

```ts
function buildFilterInput(job: NormalizedJob): FilterInput {
  return {
    title: job.title,
    company: job.company,
    description: job.description,
    location: job.location,
    tags: [
      ...job.hardRequired,
      ...job.hardNice,
      ...job.softRequired,
      ...job.softNice,
    ],
    track: job.track,
    contractType: job.contractType,
    timezone: null,
  };
}
```

- [ ] **Step 6: Update test fixtures that build `NormalizedJob` literals**

`tests/refresh.test.ts` — the filter signal moves out of `rawJson` into the real fields. In `goodJob()` add after `track: "A",`:

```ts
    description: "React TypeScript remote CET",
    location: "",
    contractType: null,
```

and simplify its `rawJson` to `JSON.stringify({ id: "good-1" })`. In `hybridJob()` override the field instead of the rawJson:

```ts
function hybridJob(): NormalizedJob {
  return {
    ...goodJob(),
    externalId: "hybrid-1",
    url: "https://remoteok.com/remote-jobs/hybrid",
    description: "hybrid 3 days in office",
    rawJson: JSON.stringify({ id: "hybrid-1" }),
  };
}
```

In the `makeJob` helper of the "second fetch does not clobber applied notes" test, add the same three fields after `track: "A",`:

```ts
    description: "React TypeScript remote CET",
    location: "",
    contractType: null,
```

`tests/db.test.ts` — in `sampleJob()` add after `track: "A",`:

```ts
    description: "",
    location: "",
    contractType: null,
```

- [ ] **Step 7: Verify green**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests pass (31 + 5 new + Task 3's additions). Typecheck is the real gate here — it proves no adapter or fixture missed the new fields.

- [ ] **Step 8: Commit**

```bash
git add src/types/job.ts src/lib/db/queries.ts src/lib/refresh.ts src/lib/sources tests/adapters.test.ts tests/refresh.test.ts tests/db.test.ts
git commit -m "refactor: move filter fields into NormalizedJob, stop parsing rawJson in refresh"
```

---

### Task 5: Enforce URL validity at the adapter boundary

Review finding §4.1 — `normalizeUrl` crashes on malformed URLs inside the DB layer; the invariant "if it's in `NormalizedJob.url`, it parses" belongs in `normalize`.

**Files:**
- Modify: `src/lib/url.ts`
- Modify: `src/lib/sources/himalayas.ts`, `src/lib/sources/wwr.ts`, `src/lib/sources/jungle.ts`, `src/lib/sources/nofluff.ts`, `src/lib/sources/remoteok.ts` (justjoin builds its URL from a template — already always valid)
- Test: `tests/url.test.ts`, `tests/adapters.test.ts`

**Interfaces:**
- Produces: `requireUrl(value: string | null | undefined): string` in `src/lib/url.ts` — returns the string if it parses as a URL, otherwise throws `new Error("unparseable listing")`.
- Consumes: Task 4's adapter shapes (this task edits the same `normalize` functions — do Task 4 first).

- [ ] **Step 1: Write the failing tests**

Append to `tests/url.test.ts`:

```ts
import { normalizeUrl, requireUrl } from "@/lib/url";

test("requireUrl passes through a valid url", () => {
  expect(requireUrl("https://example.com/jobs/1")).toBe(
    "https://example.com/jobs/1",
  );
});

test("requireUrl throws unparseable listing for junk", () => {
  expect(() => requireUrl("not a url")).toThrow(/unparseable listing/);
  expect(() => requireUrl(undefined)).toThrow(/unparseable listing/);
  expect(() => requireUrl("")).toThrow(/unparseable listing/);
});
```

(Merge the import with the existing `normalizeUrl` import line.)

Append to `tests/adapters.test.ts` — himalayas is the riskiest source because RSS-style `guid` values are often not URLs. (Beware: `urn:uuid:...` strings ARE parseable URLs with the `urn:` scheme, so the test input must be genuinely unparseable.)

```ts
test("himalayas rejects non-url guid used as url", () => {
  expect(() =>
    normalizeHimalayas({ title: "x", guid: "not a url" }),
  ).toThrow(/unparseable listing/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/url.test.ts tests/adapters.test.ts`
Expected: FAIL — `requireUrl` does not exist; himalayas currently accepts any truthy string.

- [ ] **Step 3: Implement `requireUrl`**

Add to `src/lib/url.ts` (Node ≥ 20 / Edge both have `URL.canParse`):

```ts
export function requireUrl(value: string | null | undefined): string {
  if (!value || !URL.canParse(value)) {
    throw new Error("unparseable listing");
  }
  return value;
}
```

- [ ] **Step 4: Use it in every adapter that passes through source-provided URLs**

In each `normalize`, import `requireUrl` from `@/lib/url` and wrap the URL at the point it enters the returned object:

- `himalayas.ts`: change `const url = item.applicationLink || item.guid;` → keep, then in the guard block replace the return-object's `url,` with `url: requireUrl(url),` (keep the existing `if (!title || !url)` throw for the missing case).
- `nofluff.ts`: `url: requireUrl(item.url),`
- `jungle.ts`: `url: requireUrl(url),`
- `remoteok.ts`: `url: requireUrl(url),`
- `wwr.ts`: replace the try/catch around `new URL(url)` with the simpler form — validity is now guaranteed before parsing:

```ts
  const externalId = new URL(requireUrl(url)).pathname;
```

(delete the `let externalId` / try/catch block.)

`justjoin.ts` needs no change: `url: \`https://justjoin.it/job-offer/${item.id}\`` is constructed, always valid.

- [ ] **Step 5: Verify green**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all tests pass, including the pre-existing wwr tests (behavior identical: malformed link still throws "unparseable listing").

- [ ] **Step 6: Commit**

```bash
git add src/lib/url.ts src/lib/sources tests/url.test.ts tests/adapters.test.ts
git commit -m "refactor: enforce url validity at adapter boundary via requireUrl"
```

---

### Task 6: One SELECT per listing — pass the existing row into `upsertJob`

Review finding §2.2 — `refresh.ts` calls `findJobId` and then `upsertJob` immediately re-runs the identical SELECT. Fetch the row once in the refresh loop and hand it to `upsertJob`.

**Files:**
- Modify: `src/lib/db/queries.ts:185-293`
- Modify: `src/lib/refresh.ts:104-135`
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces: `getJobBySourceExternalId(source: SourceId, externalId: string): Promise<JobRow | null>` (exported); `upsertJob(job: NormalizedJob, existing: JobRow | null)` — second parameter is now required. `findJobId` is deleted.
- Consumes: Task 4's `JobRow` shape.

- [ ] **Step 1: Update the direct-call tests first**

In `tests/db.test.ts`, add `getJobBySourceExternalId` to the queries import, then update every `upsertJob` call site:

Test "upsert updates title but preserves applied status and notes":

```ts
  const { id } = await upsertJob(sampleJob(), null);
  await applyJob(id);
  await updateNotes(id, "hello");

  await upsertJob(
    sampleJob({ title: "New Title" }),
    await getJobBySourceExternalId("remoteok", "job-1"),
  );
```

Test "applyJob sets status applied...": `const { id } = await upsertJob(sampleJob(), null);`

Test "second job with same normalized url is deduped": both calls get `, null)` as the second argument (neither externalId exists yet — dedup is by URL, not externalId).

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/db.test.ts`
Expected: FAIL — `getJobBySourceExternalId` is not exported; `upsertJob` takes one argument.

- [ ] **Step 3: Restructure `queries.ts`**

Replace `findJobId` (lines 185–191) and the private `findBySourceExternalId` (lines 193–203) with one exported, mapped query:

```ts
export async function getJobBySourceExternalId(
  source: SourceId,
  externalId: string,
): Promise<JobRow | null> {
  const result = await getDb().execute({
    sql: "SELECT * FROM jobs WHERE source = ? AND external_id = ?",
    args: [source, externalId],
  });
  if (result.rows.length === 0) return null;
  return mapJobRow(result.rows[0] as unknown as JobDbRow);
}
```

Change `upsertJob`'s signature and drop its internal lookup — the caller supplies the row:

```ts
export async function upsertJob(
  job: NormalizedJob,
  existing: JobRow | null,
): Promise<{ id: string; outcome: "inserted" | "updated" | "deduped" }> {
  const ts = now();

  if (existing) {
```

The update branch body stays identical, using `existing.id` in place of the old row's id. The dedup branch and insert branch are unchanged.

- [ ] **Step 4: Fetch once in the refresh loop**

In `src/lib/refresh.ts`, replace the `findJobId` import with `getJobBySourceExternalId`, and rewrite the loop body (currently lines 114–134):

```ts
      const existing = await getJobBySourceExternalId(source, job.externalId);

      if (!existing) {
        const filterInput = buildFilterInput(job);
        if (isInstantReject(filterInput) || !matchesCriteria(filterInput)) {
          rejected++;
          continue;
        }

        if (isOlderThanWatermark(job.postedAt, watermark)) {
          skipped++;
          continue;
        }
      }

      const { outcome } = await upsertJob(job, existing);
      if (outcome === "inserted") {
        inserted++;
      } else {
        skipped++;
      }
```

- [ ] **Step 5: Verify green**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass — `refresh.test.ts` "second fetch does not clobber applied notes" proves the update path still works end-to-end with one SELECT.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/queries.ts src/lib/refresh.ts tests/db.test.ts
git commit -m "refactor: single SELECT per listing, pass existing row into upsertJob"
```

---

### Task 7: Typed DB errors and shared error formatting; consolidate refresh finish paths

Review findings §3.1 (regex-sniffing vendor error text; `String(err)` storing "Error: ..." prefixes) and §6–7 (`fail`/success duplication in `refresh.ts`).

**Files:**
- Create: `src/lib/errors.ts`
- Modify: `src/app/api/refresh/route.ts`
- Modify: `src/lib/refresh.ts:79-159`
- Test: `tests/refresh.test.ts` (assertion tightened)

**Interfaces:**
- Produces: `errorMessage(err: unknown): string` in `src/lib/errors.ts`.
- Consumes: nothing from other tasks (apply after Task 6 since both edit `refresh.ts`).

- [ ] **Step 1: Tighten the failing-run test**

In `tests/refresh.test.ts`, test "unparseable listing fails the run", change the assertion so the stored error is the bare message, not `"Error: unparseable listing"`:

```ts
  expect(result.error).toBe("unparseable listing");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/refresh.test.ts`
Expected: FAIL — current code stores `String(err)` = `"Error: unparseable listing"`.

- [ ] **Step 3: Create the shared helper**

Create `src/lib/errors.ts`:

```ts
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```

- [ ] **Step 4: Consolidate `finish` in `refresh.ts`**

In `refreshSourceWith`, replace the `fail` closure (lines 79–99) with a single `finish` used by both outcomes, and route all caught errors through `errorMessage`:

```ts
import { errorMessage } from "@/lib/errors";
```

```ts
  const finish = async (
    status: "ok" | "failed",
    error: string,
  ): Promise<RefreshResult> => {
    await finishRefreshRun(runId, {
      finishedAt: new Date().toISOString(),
      status,
      fetched,
      inserted,
      skipped,
      rejected,
      error,
    });
    return { source, runId, status, fetched, inserted, skipped, rejected, error };
  };
```

Then:
- `return fail(String(err));` (normalize catch) → `return finish("failed", errorMessage(err));`
- the success block (both the `finishRefreshRun` call and the duplicated return object, lines 137–156) → `return finish("ok", "");`
- the outer catch → `return finish("failed", errorMessage(err));`

- [ ] **Step 5: Replace the regex with a typed check in the route**

Replace `src/app/api/refresh/route.ts` error handling — `@libsql/client` exports `LibsqlError`, and every DB failure that escapes `refreshSourceWith` (watermark/run bookkeeping when the DB is unreachable) surfaces as one:

```ts
import { NextResponse } from "next/server";
import { LibsqlError } from "@libsql/client";
import { authorizeRefresh, parseSourceParam } from "@/lib/refresh-http";
import { refreshSource } from "@/lib/refresh";

export async function POST(request: Request) {
  const secret = process.env.REFRESH_SECRET;
  if (!secret || !authorizeRefresh(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const source = parseSourceParam(url.searchParams.get("source"));
  if (!source) {
    return NextResponse.json({ error: "unknown source" }, { status: 400 });
  }

  try {
    const result = await refreshSource(source);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LibsqlError) {
      return NextResponse.json({ error: "db" }, { status: 503 });
    }
    return new NextResponse(null, { status: 500 });
  }
}
```

(The `DB_ERROR` regex const is deleted.)

- [ ] **Step 6: Verify green**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all pass; banner-visible errors no longer carry the `Error:` prefix.

- [ ] **Step 7: Commit**

```bash
git add src/lib/errors.ts src/lib/refresh.ts src/app/api/refresh/route.ts tests/refresh.test.ts
git commit -m "refactor: typed LibsqlError handling and shared errorMessage helper"
```

---

### Task 8: Replace `AppliedRow` generation machinery with a plain trailing debounce

Review finding §2.3 — four refs, a generation counter, and a recursive re-flush for last-write-wins autosave; latent double-save; two `react-hooks/exhaustive-deps` warnings (one disable comment suppresses nothing).

**Files:**
- Modify: `src/components/AppliedRow.tsx` (logic block, lines 7–55; JSX unchanged)

**Interfaces:**
- Consumes: `saveNotesAction(id: string, notes: string): Promise<void>` from `src/app/actions/jobs.ts`; `JobRow` from queries (post-Task 4 shape — no change needed here).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Rewrite the component logic**

Replace lines 7–55 of `src/components/AppliedRow.tsx` (keep the JSX return as-is). `saveNotesAction` always receives `notesRef.current` — the latest value — so last-write-wins needs no generation counter: a keystroke during an in-flight save re-marks dirty and re-arms the timer, and the next flush sends the newest text.

```tsx
export function AppliedRow({ job }: { job: JobRow }) {
  const [notes, setNotes] = useState(job.notes);
  const notesRef = useRef(job.notes);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirtyRef.current) {
      setNotes(job.notes);
      notesRef.current = job.notes;
    }
  }, [job.notes]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) {
        dirtyRef.current = false;
        void saveNotesAction(job.id, notesRef.current);
      }
    };
  }, [job.id]);

  function handleNotesChange(value: string) {
    setNotes(value);
    notesRef.current = value;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dirtyRef.current = false;
      void saveNotesAction(job.id, notesRef.current);
    }, 500);
  }
```

Deleted: `saveGenerationRef`, `flushNotes`, the recursion, and the ineffective `eslint-disable-next-line`.

- [ ] **Step 2: Verify green with zero lint warnings**

Run: `npm test && npm run typecheck && npm run lint`
Expected: tests pass, typecheck clean, and lint now reports **0 warnings** — both `react-hooks/exhaustive-deps` warnings are gone.

- [ ] **Step 3: Manual smoke check (optional but cheap)**

Run: `npm run dev`, open `/applied` with at least one applied job, type in notes, wait 1s, reload — text persists. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppliedRow.tsx
git commit -m "refactor: replace AppliedRow generation machinery with plain debounce"
```

---

**PHASE GATE B→C:** run session-handoff skill, mark Phase B completed, update `docs/superpowers/plans/2026-08-29-job-inbox.md` frontmatter if applicable, stop, and tell the operator: switch model to Opus 4.8 Medium for the pre-merge T2 review (existing plan Task 11), which now also re-checks these fixes against `.superpowers/sdd/thermo-review.md`.

---

## Findings coverage map

| Review finding | Task |
| --- | --- |
| 1.1 rawJson duck-typing in refresh layer | 4 |
| 1.2 duplicate session verifier / misleading pin test | 3 |
| 2.1 source list in four places | 2 |
| 2.2 double SELECT in upsert path | 6 |
| 2.3 AppliedRow generation machinery + lint warnings | 8 |
| 3.1 DB-error regex + `String(err)` prefixes | 7 |
| 4.1 unguarded `new URL()` in normalizeUrl path | 5 |
| 4.2 eventStatement ignored in own file | 1 |
| 4.3 extractOffers/extractPostings duplication | 1 |
| 6–7 url.ts no-op, fail/success duplication, misleading test comment, tsbuildinfo | 1, 7, 3, 1 |

Deliberately NOT done (reviewer's `ON CONFLICT` suggestion): the full `INSERT ... ON CONFLICT DO UPDATE` rewrite conflicts with the normalized-URL dedup pre-read (which must run before insert and is keyed on a non-unique index) and with event-row insertion for pre-existing ids. Task 6 takes the reviewer's stated minimum — one SELECT per listing — which removes the measurable waste; the check-then-insert race is single-writer in production (one GitHub Actions job per source) and harmless.
