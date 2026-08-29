import { errorMessage } from "@/lib/errors";
import { isInstantReject, matchesCriteria } from "@/lib/filters";
import {
  createRefreshRun,
  finishRefreshRun,
  getJobBySourceExternalId,
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

  try {
    const raws = await adapter.fetchListings();

    for (const raw of raws) {
      fetched++;

      let job: NormalizedJob;
      try {
        job = adapter.normalize(raw);
      } catch (err) {
        return finish("failed", errorMessage(err));
      }

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
    }

    return finish("ok", "");
  } catch (err) {
    return finish("failed", errorMessage(err));
  }
}

export async function refreshSource(source: SourceId): Promise<RefreshResult> {
  return refreshSourceWith(getAdapter(source), source);
}
