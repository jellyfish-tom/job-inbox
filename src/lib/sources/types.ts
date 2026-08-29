import type { NormalizedJob, SourceId } from "@/types/job";

export type SourceAdapter = {
  source: SourceId;
  fetchListings(): Promise<unknown[]>;
  normalize(raw: unknown): NormalizedJob;
};
