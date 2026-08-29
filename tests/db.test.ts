import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, expect, test } from "vitest";
import { getDb, resetDbClient } from "@/lib/db/client";
import {
  applyJob,
  createRefreshRun,
  finishRefreshRun,
  getJobBySourceExternalId,
  getWatermark,
  updateNotes,
  upsertJob,
} from "@/lib/db/queries";
import type { NormalizedJob } from "@/types/job";

process.env.TURSO_DATABASE_URL = "file:tests/tmp-db.test.db";

const dbPath = path.join(process.cwd(), "tests/tmp-db.test.db");
const migrationSql = readFileSync(
  path.join(process.cwd(), "db/migrations/001_init.sql"),
  "utf8",
);

function sampleJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    source: "remoteok",
    externalId: "job-1",
    url: "https://remoteok.com/remote-jobs/123",
    title: "Engineer",
    company: "Acme",
    track: "A",
    description: "",
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
    rawJson: '{"id":"job-1"}',
    postedAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
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

test("upsert updates title but preserves applied status and notes", async () => {
  const { id } = await upsertJob(sampleJob(), null);
  await applyJob(id);
  await updateNotes(id, "hello");

  await upsertJob(
    sampleJob({ title: "New Title" }),
    await getJobBySourceExternalId("remoteok", "job-1"),
  );

  const row = await getDb().execute({
    sql: "SELECT title, status, notes FROM jobs WHERE id = ?",
    args: [id],
  });
  expect(row.rows[0].title).toBe("New Title");
  expect(row.rows[0].status).toBe("applied");
  expect(row.rows[0].notes).toBe("hello");
});

test("upsertJob throws when existing row key does not match job", async () => {
  await upsertJob(sampleJob(), null);
  const existing = await getJobBySourceExternalId("remoteok", "job-1");
  expect(existing).toBeTruthy();

  await expect(
    upsertJob(
      sampleJob({ source: "himalayas", externalId: "job-2" }),
      existing,
    ),
  ).rejects.toThrow(/upsertJob.*does not match/);
});

test("applyJob sets status applied, appliedAt, and applied event", async () => {
  const { id } = await upsertJob(sampleJob(), null);
  await applyJob(id);

  const row = await getDb().execute({
    sql: "SELECT status, applied_at FROM jobs WHERE id = ?",
    args: [id],
  });
  expect(row.rows[0].status).toBe("applied");
  expect(row.rows[0].applied_at).toBeTruthy();

  const events = await getDb().execute({
    sql: "SELECT type, actor FROM job_events WHERE job_id = ?",
    args: [id],
  });
  const applied = events.rows.find((e) => e.type === "applied");
  expect(applied).toBeTruthy();
  expect(applied?.actor).toBe("user");
});

test("second job with same normalized url is deduped", async () => {
  await upsertJob(
    sampleJob({
      externalId: "job-a",
      url: "https://remoteok.com/remote-jobs/123",
    }),
    null,
  );

  const second = await upsertJob(
    sampleJob({
      externalId: "job-b",
      url: "https://remoteok.com/remote-jobs/123/?utm_source=x",
    }),
    null,
  );

  expect(second.outcome).toBe("deduped");

  const count = await getDb().execute("SELECT count(*) AS c FROM jobs");
  expect(count.rows[0].c).toBe(1);
});

test("getWatermark returns latest ok finishedAt and ignores failed runs", async () => {
  expect(await getWatermark("remoteok")).toBeNull();

  const runId = await createRefreshRun("remoteok", null);
  const finishedAt = "2026-08-29T12:00:00.000Z";
  await finishRefreshRun(runId, {
    finishedAt,
    status: "ok",
    fetched: 1,
    inserted: 1,
    skipped: 0,
    rejected: 0,
    error: "",
  });

  expect(await getWatermark("remoteok")).toBe(finishedAt);

  const failedRunId = await createRefreshRun("remoteok", finishedAt);
  await finishRefreshRun(failedRunId, {
    finishedAt: "2026-08-29T13:00:00.000Z",
    status: "failed",
    fetched: 0,
    inserted: 0,
    skipped: 0,
    rejected: 0,
    error: "boom",
  });

  expect(await getWatermark("remoteok")).toBe(finishedAt);
});
