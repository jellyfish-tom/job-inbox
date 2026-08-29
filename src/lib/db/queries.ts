import { getDb } from "@/lib/db/client";
import { normalizeUrl } from "@/lib/url";
import type { JobStatus, NormalizedJob, SourceId } from "@/types/job";

export type JobRow = NormalizedJob & {
  id: string;
  status: JobStatus;
  appliedAt: string | null;
  notes: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type RefreshRunRow = {
  id: string;
  source: SourceId;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "ok" | "failed";
  fetched: number;
  inserted: number;
  skipped: number;
  rejected: number;
  error: string;
  watermark: string | null;
};

type JobDbRow = {
  id: string;
  source: string;
  external_id: string;
  url: string;
  title: string;
  company: string;
  track: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_raw: string | null;
  hard_required: string;
  hard_nice: string;
  soft_required: string;
  soft_nice: string;
  raw_json: string;
  posted_at: string | null;
  status: string;
  applied_at: string | null;
  notes: string;
  first_seen_at: string;
  last_seen_at: string;
};

type RefreshRunDbRow = {
  id: string;
  source: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  fetched: number;
  inserted: number;
  skipped: number;
  rejected: number;
  error: string;
  watermark: string | null;
};

function now(): string {
  return new Date().toISOString();
}

function parseSkills(json: string): string[] {
  return JSON.parse(json) as string[];
}

function mapJobRow(row: JobDbRow): JobRow {
  return {
    id: row.id,
    source: row.source as SourceId,
    externalId: row.external_id,
    url: row.url,
    title: row.title,
    company: row.company,
    track: row.track as JobRow["track"],
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    salaryCurrency: row.salary_currency,
    salaryRaw: row.salary_raw,
    hardRequired: parseSkills(row.hard_required),
    hardNice: parseSkills(row.hard_nice),
    softRequired: parseSkills(row.soft_required),
    softNice: parseSkills(row.soft_nice),
    rawJson: row.raw_json,
    postedAt: row.posted_at,
    status: row.status as JobStatus,
    appliedAt: row.applied_at,
    notes: row.notes,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapRefreshRunRow(row: RefreshRunDbRow): RefreshRunRow {
  return {
    id: row.id,
    source: row.source as SourceId,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status as RefreshRunRow["status"],
    fetched: row.fetched,
    inserted: row.inserted,
    skipped: row.skipped,
    rejected: row.rejected,
    error: row.error,
    watermark: row.watermark,
  };
}

async function insertEvent(
  jobId: string,
  type: string,
  actor: string,
): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO job_events (id, job_id, type, at, actor, payload)
          VALUES (?, ?, ?, ?, ?, '{}')`,
    args: [crypto.randomUUID(), jobId, type, now(), actor],
  });
}

export async function createRefreshRun(
  source: SourceId,
  watermark: string | null,
): Promise<string> {
  const id = crypto.randomUUID();
  await getDb().execute({
    sql: `INSERT INTO refresh_runs (id, source, started_at, status, watermark)
          VALUES (?, ?, ?, 'running', ?)`,
    args: [id, source, now(), watermark],
  });
  return id;
}

export async function finishRefreshRun(
  id: string,
  fields: Omit<RefreshRunRow, "id" | "source" | "startedAt" | "watermark">,
): Promise<void> {
  await getDb().execute({
    sql: `UPDATE refresh_runs
          SET finished_at = ?, status = ?, fetched = ?, inserted = ?,
              skipped = ?, rejected = ?, error = ?
          WHERE id = ?`,
    args: [
      fields.finishedAt,
      fields.status,
      fields.fetched,
      fields.inserted,
      fields.skipped,
      fields.rejected,
      fields.error,
      id,
    ],
  });
}

export async function getWatermark(source: SourceId): Promise<string | null> {
  const result = await getDb().execute({
    sql: `SELECT max(finished_at) AS watermark
          FROM refresh_runs
          WHERE source = ? AND status = 'ok'`,
    args: [source],
  });
  const value = result.rows[0]?.watermark;
  return value == null ? null : String(value);
}

async function findBySourceExternalId(
  source: SourceId,
  externalId: string,
): Promise<JobDbRow | null> {
  const result = await getDb().execute({
    sql: "SELECT * FROM jobs WHERE source = ? AND external_id = ?",
    args: [source, externalId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as JobDbRow;
}

async function findByNormalizedUrl(url: string): Promise<JobDbRow | null> {
  const normalized = normalizeUrl(url);
  const result = await getDb().execute("SELECT * FROM jobs");
  for (const row of result.rows) {
    const job = row as unknown as JobDbRow;
    if (normalizeUrl(job.url) === normalized) return job;
  }
  return null;
}

export async function upsertJob(
  job: NormalizedJob,
): Promise<{ id: string; outcome: "inserted" | "updated" | "deduped" }> {
  const existing = await findBySourceExternalId(job.source, job.externalId);
  const ts = now();

  if (existing) {
    await getDb().execute({
      sql: `UPDATE jobs
            SET title = ?, company = ?,
                salary_min = ?, salary_max = ?, salary_currency = ?, salary_raw = ?,
                hard_required = ?, hard_nice = ?, soft_required = ?, soft_nice = ?,
                raw_json = ?, last_seen_at = ?
            WHERE id = ?`,
      args: [
        job.title,
        job.company,
        job.salaryMin,
        job.salaryMax,
        job.salaryCurrency,
        job.salaryRaw,
        JSON.stringify(job.hardRequired),
        JSON.stringify(job.hardNice),
        JSON.stringify(job.softRequired),
        JSON.stringify(job.softNice),
        job.rawJson,
        ts,
        existing.id,
      ],
    });
    await insertEvent(existing.id, "fetched", "system");
    return { id: existing.id, outcome: "updated" };
  }

  const deduped = await findByNormalizedUrl(job.url);
  if (deduped) {
    await insertEvent(deduped.id, "deduped", "system");
    return { id: deduped.id, outcome: "deduped" };
  }

  const id = crypto.randomUUID();
  await getDb().execute({
    sql: `INSERT INTO jobs (
            id, source, external_id, url, title, company, track,
            salary_min, salary_max, salary_currency, salary_raw,
            hard_required, hard_nice, soft_required, soft_nice,
            raw_json, posted_at, status, first_seen_at, last_seen_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
    args: [
      id,
      job.source,
      job.externalId,
      job.url,
      job.title,
      job.company,
      job.track,
      job.salaryMin,
      job.salaryMax,
      job.salaryCurrency,
      job.salaryRaw,
      JSON.stringify(job.hardRequired),
      JSON.stringify(job.hardNice),
      JSON.stringify(job.softRequired),
      JSON.stringify(job.softNice),
      job.rawJson,
      job.postedAt,
      ts,
      ts,
    ],
  });
  await insertEvent(id, "fetched", "system");
  return { id, outcome: "inserted" };
}

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
    {
      sql: `INSERT INTO job_events (id, job_id, type, at, actor, payload)
            VALUES (?, ?, 'applied', ?, 'user', '{}')`,
      args: [crypto.randomUUID(), id, ts],
    },
  ]);
}

export async function rejectJob(id: string): Promise<void> {
  const ts = now();
  await getDb().batch([
    {
      sql: "UPDATE jobs SET status = 'rejected' WHERE id = ?",
      args: [id],
    },
    {
      sql: `INSERT INTO job_events (id, job_id, type, at, actor, payload)
            VALUES (?, ?, 'rejected', ?, 'user', '{}')`,
      args: [crypto.randomUUID(), id, ts],
    },
  ]);
}

export async function updateNotes(id: string, notes: string): Promise<void> {
  const ts = now();
  await getDb().batch([
    {
      sql: "UPDATE jobs SET notes = ? WHERE id = ?",
      args: [notes, id],
    },
    {
      sql: `INSERT INTO job_events (id, job_id, type, at, actor, payload)
            VALUES (?, ?, 'notes_updated', ?, 'user', '{}')`,
      args: [crypto.randomUUID(), id, ts],
    },
  ]);
}

export async function listInbox(): Promise<JobRow[]> {
  const result = await getDb().execute({
    sql: `SELECT * FROM jobs WHERE status = 'new' ORDER BY first_seen_at DESC`,
  });
  return result.rows.map((row) => mapJobRow(row as unknown as JobDbRow));
}

export async function listApplied(): Promise<JobRow[]> {
  const result = await getDb().execute({
    sql: `SELECT * FROM jobs WHERE status = 'applied' ORDER BY applied_at DESC`,
  });
  return result.rows.map((row) => mapJobRow(row as unknown as JobDbRow));
}

export async function listLatestRuns(): Promise<RefreshRunRow[]> {
  const result = await getDb().execute({
    sql: `SELECT r.*
          FROM refresh_runs r
          INNER JOIN (
            SELECT source, max(started_at) AS started_at
            FROM refresh_runs
            GROUP BY source
          ) latest ON r.source = latest.source AND r.started_at = latest.started_at
          ORDER BY r.source`,
  });
  return result.rows.map((row) =>
    mapRefreshRunRow(row as unknown as RefreshRunDbRow),
  );
}
