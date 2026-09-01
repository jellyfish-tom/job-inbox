import type { NormalizedJob, SourceCapabilities, SourceFilter } from "@/types/job";
import { requireUrl } from "@/lib/url";
import { nonempty, type SourceAdapter } from "./types";

export const remoteokCapabilities: SourceCapabilities = {
  source: "remoteok",
  fields: [
    {
      id: "tags",
      label: "Tags",
      kind: "both",
      valueType: "tokens",
      queryKey: "tags",
    },
  ],
};

type RemoteokRaw = {
  id?: string | number;
  position?: string;
  company?: string;
  tags?: string[];
  url?: string;
  date?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  location?: string;
};

const LISTINGS_URL = "https://remoteok.com/api";

export function remoteokApiUrl(filter: SourceFilter): string {
  const url = new URL(LISTINGS_URL);
  const tags = nonempty(filter.values.tags);
  if (tags.length) {
    url.searchParams.set("tags", tags.join(","));
  }
  return url.toString();
}

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as RemoteokRaw;
  if (!item.id || !item.position) {
    throw new Error("unparseable listing");
  }

  const url = item.url;
  if (!url) {
    throw new Error("unparseable listing");
  }

  const salaryParts: string[] = [];
  if (item.salary_min != null && item.salary_min > 0) {
    salaryParts.push(String(item.salary_min));
  }
  if (item.salary_max != null && item.salary_max > 0) {
    salaryParts.push(String(item.salary_max));
  }
  const salaryRaw = salaryParts.length > 0 ? salaryParts.join("–") : null;

  return {
    source: "remoteok",
    externalId: String(item.id),
    url: requireUrl(url),
    title: item.position,
    company: item.company ?? "",
    description: item.description ?? "",
    location: item.location ?? "",
    contractType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryRaw,
    hardRequired: item.tags ?? [],
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: item.date ?? null,
  };
}

export function matchFields(
  raw: unknown,
  job: NormalizedJob,
): Record<string, string[]> {
  const item = raw as RemoteokRaw;
  return { tags: item.tags ?? job.hardRequired };
}

export const remoteokAdapter: SourceAdapter = {
  source: "remoteok",
  capabilities: remoteokCapabilities,
  async fetchListings(filter: SourceFilter) {
    const res = await fetch(remoteokApiUrl(filter), {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (!res.ok) {
      throw new Error(`remoteok fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as unknown[];
    return data.slice(1);
  },
  normalize,
  matchFields,
};
