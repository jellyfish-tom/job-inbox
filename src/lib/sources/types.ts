import type {
  NormalizedJob,
  SourceCapabilities,
  SourceFilter,
  SourceId,
} from "@/types/job";

export type SourceAdapter = {
  source: SourceId;
  capabilities: SourceCapabilities;
  fetchListings(filter: SourceFilter): Promise<unknown[]>;
  normalize(raw: unknown): NormalizedJob;
  matchFields(raw: unknown, job: NormalizedJob): Record<string, string[]>;
};

export function joinFilterTokens(values: string[] | undefined): string {
  return (values ?? []).join(" ").trim();
}

export function nonempty(values: string[] | undefined): string[] {
  return (values ?? []).map((v) => v.trim()).filter((v) => v !== "");
}
