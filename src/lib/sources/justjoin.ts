import type { NormalizedJob } from "@/types/job";
import { pickArray } from "./parse";
import type { SourceAdapter } from "./types";

type JustjoinRaw = {
  guid?: string;
  slug?: string;
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
  workplaceType?: string;
};

const LISTINGS_URL = "https://justjoin.it/api/candidate-api/offers";

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as JustjoinRaw;
  if (!item.guid || !item.slug || !item.title) {
    throw new Error("unparseable listing");
  }

  const employment = item.employmentTypes?.[0];

  return {
    source: "justjoin",
    externalId: item.guid,
    url: `https://justjoin.it/job-offer/${item.slug}`,
    title: item.title,
    company: item.companyName ?? "",
    track: "B",
    description: "",
    location: [item.workplaceType ?? "", "Poland"].join(" ").trim(),
    contractType: employment?.type ?? null,
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
    const res = await fetch(LISTINGS_URL, {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (!res.ok) {
      throw new Error(`justjoin fetch failed: ${res.status}`);
    }
    return pickArray(await res.json(), ["data", "offers", "items"]);
  },
  normalize,
};
