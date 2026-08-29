import type { NormalizedJob } from "@/types/job";
import type { SourceAdapter } from "./types";

type HimalayasRaw = {
  title?: string;
  companyName?: string;
  guid?: string;
  applicationLink?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
  categories?: string[];
  description?: string;
  locationRestrictions?: string[];
  pubDate?: string;
};

const LISTINGS_URL =
  "https://himalayas.app/jobs/api/search?q=react&seniority=Senior&sort=recent&limit=20";

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as HimalayasRaw;
  const title = item.title;
  const url = item.applicationLink || item.guid;
  if (!title || !url) {
    throw new Error("unparseable listing");
  }

  return {
    source: "himalayas",
    externalId: item.guid ?? url,
    url,
    title,
    company: item.companyName ?? "",
    track: "A",
    description: item.description ?? "",
    location: (item.locationRestrictions ?? []).join(" "),
    contractType: null,
    salaryMin: item.minSalary ?? null,
    salaryMax: item.maxSalary ?? null,
    salaryCurrency: item.currency ?? null,
    salaryRaw: null,
    hardRequired: item.categories ?? [],
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: item.pubDate ?? null,
  };
}

export const himalayasAdapter: SourceAdapter = {
  source: "himalayas",
  async fetchListings() {
    const res = await fetch(LISTINGS_URL, {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (!res.ok) {
      throw new Error(`himalayas fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as { jobs?: unknown[] };
    return data.jobs ?? [];
  },
  normalize,
};
