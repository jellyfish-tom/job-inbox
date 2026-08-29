import type { NormalizedJob } from "@/types/job";
import type { SourceAdapter } from "./types";

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

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as RemoteokRaw;
  if (!item.id || !item.position) {
    throw new Error("unparseable listing");
  }

  const url = item.url;
  if (!url) {
    throw new Error("unparseable listing");
  }

  const salaryRaw =
    item.salary_min != null ? `${item.salary_min}–${item.salary_max}` : null;

  return {
    source: "remoteok",
    externalId: String(item.id),
    url,
    title: item.position,
    company: item.company ?? "",
    track: "A",
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

export const remoteokAdapter: SourceAdapter = {
  source: "remoteok",
  async fetchListings() {
    const res = await fetch(LISTINGS_URL, {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (!res.ok) {
      throw new Error(`remoteok fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as unknown[];
    return data.slice(1);
  },
  normalize,
};
