import { errorMessage } from "@/lib/errors";
import { matchesSource, toMatchInput } from "@/lib/filters";
import {
  countJobsForSource,
  createRefreshRun,
  finishRefreshRun,
  findJobForUpsert,
  getSourceFilter,
  getWatermark,
  upsertJob,
} from "@/lib/db/queries";
import { getAdapter } from "@/lib/sources/registry";
import type { SourceAdapter } from "@/lib/sources/types";
import type { NormalizedJob, SourceFilter, SourceId } from "@/types/job";

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
  filter: SourceFilter,
): Promise<RefreshResult> {
  const watermark = await getWatermark(source);
  const knownCount = await countJobsForSource(source);
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
    const raws = await adapter.fetchListings(filter);

    for (const raw of raws) {
      fetched++;

      let job: NormalizedJob;
      try {
        job = adapter.normalize(raw);
      } catch (err) {
        return finish("failed", errorMessage(err));
      }

      const rawIds = raw as { id?: string; reference?: string };
      const existing = await findJobForUpsert(
        job,
        [rawIds.id, rawIds.reference].filter((value): value is string =>
          Boolean(value),
        ),
      );

      if (!existing) {
        const matchInput = toMatchInput(
          job.title,
          job.description,
          [...job.hardRequired, ...job.hardNice],
          adapter.matchFields(raw, job),
        );
        if (!matchesSource(matchInput, filter, adapter.capabilities)) {
          rejected++;
          continue;
        }
        if (
          knownCount > 0 &&
          isOlderThanWatermark(job.postedAt, watermark)
        ) {
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
  const filter = await getSourceFilter(source);
  return refreshSourceWith(getAdapter(source), source, filter);
}
