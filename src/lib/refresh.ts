import { isInstantReject, matchesCriteria } from "@/lib/filters";
import {
  createRefreshRun,
  findJobId,
  finishRefreshRun,
  getWatermark,
  upsertJob,
} from "@/lib/db/queries";
import { getAdapter } from "@/lib/sources/registry";
import type { SourceAdapter } from "@/lib/sources/types";
import type { FilterInput, NormalizedJob, SourceId } from "@/types/job";

export type RefreshResult = {
  source: SourceId;
  runId: string;
  status: "ok" | "failed";
  fetched: number;
  inserted: number;
  skipped: number;
  rejected: number;
  error: string;
};

function buildFilterInput(job: NormalizedJob): FilterInput {
  let description = "";
  let location = "";
  let contractType: string | null = null;

  try {
    const parsed = JSON.parse(job.rawJson) as Record<string, unknown>;
    description = String(parsed.description ?? "");
    location = Array.isArray(parsed.locationRestrictions)
      ? parsed.locationRestrictions.join(" ")
      : String(parsed.workplaceType ?? "");
    if (parsed.contractType != null) {
      contractType = String(parsed.contractType);
    }
  } catch {
    // best-effort parse
  }

  return {
    title: job.title,
    company: job.company,
    description,
    location,
    tags: [
      ...job.hardRequired,
      ...job.hardNice,
      ...job.softRequired,
      ...job.softNice,
    ],
    track: job.track,
    contractType,
    timezone: null,
  };
}

function isOlderThanWatermark(
  postedAt: string | null,
  watermark: string | null,
): boolean {
  if (!postedAt || !watermark) return false;
  return Date.parse(postedAt) <= Date.parse(watermark);
}

export async function refreshSourceWith(
  adapter: SourceAdapter,
  source: SourceId,
): Promise<RefreshResult> {
  const watermark = await getWatermark(source);
  const runId = await createRefreshRun(source, watermark);

  let fetched = 0;
  let inserted = 0;
  let skipped = 0;
  let rejected = 0;

  const fail = async (error: string): Promise<RefreshResult> => {
    await finishRefreshRun(runId, {
      finishedAt: new Date().toISOString(),
      status: "failed",
      fetched,
      inserted,
      skipped,
      rejected,
      error,
    });
    return {
      source,
      runId,
      status: "failed",
      fetched,
      inserted,
      skipped,
      rejected,
      error,
    };
  };

  try {
    const raws = await adapter.fetchListings();

    for (const raw of raws) {
      fetched++;

      let job: NormalizedJob;
      try {
        job = adapter.normalize(raw);
      } catch (err) {
        return fail(String(err));
      }

      const existingId = await findJobId(source, job.externalId);

      if (!existingId) {
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

      const { outcome } = await upsertJob(job);
      if (outcome === "inserted") {
        inserted++;
      } else {
        skipped++;
      }
    }

    await finishRefreshRun(runId, {
      finishedAt: new Date().toISOString(),
      status: "ok",
      fetched,
      inserted,
      skipped,
      rejected,
      error: "",
    });

    return {
      source,
      runId,
      status: "ok",
      fetched,
      inserted,
      skipped,
      rejected,
      error: "",
    };
  } catch (err) {
    return fail(String(err));
  }
}

export async function refreshSource(source: SourceId): Promise<RefreshResult> {
  return refreshSourceWith(getAdapter(source), source);
}
