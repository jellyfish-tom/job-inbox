import type { NormalizedJob } from "@/types/job";
import { pickArray } from "./parse";
import type { SourceAdapter } from "./types";

type JustjoinRaw = {
  id?: string;
  title?: string;
  companyName?: string;
  requiredSkills?: { name?: string }[];
  employmentTypes?: {
    type?: string;
    from?: number;
    to?: number;
    currency?: string;
  }[];
  publishedAt?: string;
};

const PRIMARY_URL = "https://justjoin.it/api/offers";
const FALLBACK_URL = "https://api.justjoin.it/v2/user-panel/offers";

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as JustjoinRaw;
  if (!item.id || !item.title) {
    throw new Error("unparseable listing");
  }

  const employment = item.employmentTypes?.[0];

  return {
    source: "justjoin",
    externalId: item.id,
    url: `https://justjoin.it/job-offer/${item.id}`,
    title: item.title,
    company: item.companyName ?? "",
    track: "B",
    salaryMin: employment?.from ?? null,
    salaryMax: employment?.to ?? null,
    salaryCurrency: employment?.currency ?? null,
    salaryRaw: null,
    hardRequired: (item.requiredSkills ?? [])
      .map((skill) => skill.name)
      .filter((name): name is string => Boolean(name)),
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: item.publishedAt ?? null,
  };
}

export const justjoin: SourceAdapter = {
  source: "justjoin",
  async fetchListings() {
    let res = await fetch(PRIMARY_URL, {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (res.status === 404) {
      res = await fetch(FALLBACK_URL, {
        headers: { "User-Agent": "job-inbox/0.1" },
      });
    }
    if (!res.ok) {
      throw new Error(`justjoin fetch failed: ${res.status}`);
    }
    return pickArray(await res.json(), ["data", "offers", "items"]);
  },
  normalize,
};
