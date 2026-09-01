import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, expect, test } from "vitest";
import { getDb, resetDbClient } from "@/lib/db/client";
import {
  applyJob,
  listApplied,
  listInbox,
  updateNotes,
} from "@/lib/db/queries";
import { DEFAULT_SOURCE_FILTERS } from "@/lib/filter-defaults";
import { refreshSourceWith } from "@/lib/refresh";
import { remoteokCapabilities } from "@/lib/sources/remoteok";
import type { SourceAdapter } from "@/lib/sources/types";
import type { NormalizedJob, SourceFilter } from "@/types/job";

process.env.TURSO_DATABASE_URL = "file:tests/tmp-refresh.test.db";

const dbPath = path.join(process.cwd(), "tests/tmp-refresh.test.db");
const migrationSql = readFileSync(
  path.join(process.cwd(), "db/migrations/001_init.sql"),
  "utf8",
);

const goodRaw = { id: "good" };
const hybridRaw = { id: "hybrid" };
const acceptAll: SourceFilter = { values: {}, exclude: [] };

function goodJob(): NormalizedJob {
  return {
    source: "remoteok",
    externalId: "good-1",
    url: "https://remoteok.com/remote-jobs/good",
    title: "Senior Frontend Engineer",
    company: "Acme",
    description: "React TypeScript remote CET",
    location: "",
    contractType: null,
    salaryMin: 100000,
    salaryMax: 150000,
    salaryCurrency: "USD",
    salaryRaw: "100-150k",
    hardRequired: ["TypeScript"],
    hardNice: ["React"],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify({ id: "good-1" }),
    postedAt: "2026-08-28T00:00:00.000Z",
  };
}

function hybridJob(): NormalizedJob {
  return {
    ...goodJob(),
    externalId: "hybrid-1",
    url: "https://remoteok.com/remote-jobs/hybrid",
    description: "hybrid 3 days in office",
    rawJson: JSON.stringify({ id: "hybrid-1" }),
  };
}

function stub(partial: Partial<SourceAdapter>): SourceAdapter {
  return {
    source: "remoteok",
    capabilities: remoteokCapabilities,
    fetchListings: async () => [],
    normalize: () => {
      throw new Error("unused");
    },
    matchFields: (_raw, job) => ({
      tags: [...job.hardRequired, ...job.hardNice],
    }),
    ...partial,
  };
}

beforeEach(async () => {
  resetDbClient();
  if (existsSync(dbPath)) unlinkSync(dbPath);
  await getDb().executeMultiple(migrationSql);
});

afterAll(() => {
  resetDbClient();
  if (existsSync(dbPath)) unlinkSync(dbPath);
});

test("inserts matching job and counts rejected", async () => {
  const adapter = stub({
    fetchListings: async () => [goodRaw, hybridRaw],
    normalize: (raw: unknown) => {
      if ((raw as { id: string }).id === "good") return goodJob();
      return hybridJob();
    },
  });
  const result = await refreshSourceWith(
    adapter,
    "remoteok",
    DEFAULT_SOURCE_FILTERS.remoteok,
  );
  expect(result.status).toBe("ok");
  expect(result.inserted).toBe(1);
  expect(result.rejected).toBe(1);
});

test("second fetch does not clobber applied notes", async () => {
  const raw = { id: "applied-test" };
  const makeJob = (title: string): NormalizedJob => ({
    source: "remoteok",
    externalId: "job-applied-1",
    url: "https://remoteok.com/remote-jobs/applied",
    title,
    company: "Acme",
    description: "React TypeScript remote CET",
    location: "",
    contractType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryRaw: null,
    hardRequired: ["React", "TypeScript"],
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify({
      id: "applied-test",
    }),
    postedAt: "2026-08-28T00:00:00.000Z",
  });

  const adapter = stub({
    fetchListings: async () => [raw],
    normalize: () => makeJob("Senior Frontend Engineer"),
  });

  await refreshSourceWith(adapter, "remoteok", DEFAULT_SOURCE_FILTERS.remoteok);

  const inbox1 = await listInbox();
  expect(inbox1).toHaveLength(1);
  await applyJob(inbox1[0].id);
  await updateNotes(inbox1[0].id, "hello");

  const adapter2 = stub({
    fetchListings: async () => [raw],
    normalize: () => makeJob("New Title"),
  });
  await refreshSourceWith(adapter2, "remoteok", DEFAULT_SOURCE_FILTERS.remoteok);

  const inbox = await listInbox();
  expect(inbox).toHaveLength(0);
  const applied = await listApplied();
  expect(applied[0].notes).toBe("hello");
  expect(applied[0].title).toBe("New Title");
});

test("unparseable listing fails the run", async () => {
  const adapter = stub({
    fetchListings: async () => [{ nope: true }],
    normalize: () => {
      throw new Error("unparseable listing");
    },
  });
  const result = await refreshSourceWith(
    adapter,
    "remoteok",
    DEFAULT_SOURCE_FILTERS.remoteok,
  );
  expect(result.status).toBe("failed");
  expect(result.error).toBe("unparseable listing");
});

test("custom accept-all filter keeps a job the default would reject", async () => {
  const adapter = stub({
    fetchListings: async () => [hybridRaw],
    normalize: () => hybridJob(),
  });
  const result = await refreshSourceWith(adapter, "remoteok", acceptAll);
  expect(result.status).toBe("ok");
  expect(result.inserted).toBe(1);
  expect(result.rejected).toBe(0);
});
