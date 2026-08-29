import type { NormalizedJob } from "@/types/job";
import { pickArray } from "./parse";
import type { SourceAdapter } from "./types";

type NofluffRaw = {
  id?: string;
  title?: string;
  company?: { name?: string };
  skills?: { must?: string[]; nice?: string[] };
  posted?: string;
  url?: string;
};

const LISTINGS_URL = "https://nofluffjobs.com/api/search/posting";

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as NofluffRaw;
  if (!item.id || !item.title || !item.url) {
    throw new Error("unparseable listing");
  }

  return {
    source: "nofluff",
    externalId: item.id,
    url: item.url,
    title: item.title,
    company: item.company?.name ?? "",
    track: "B",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryRaw: null,
    hardRequired: item.skills?.must ?? [],
    hardNice: item.skills?.nice ?? [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: item.posted ?? null,
  };
}

export const nofluff: SourceAdapter = {
  source: "nofluff",
  async fetchListings() {
    const res = await fetch(LISTINGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "job-inbox/0.1",
      },
      body: JSON.stringify({
        criteria: "senior frontend react typescript remote",
        page: 1,
        withSalary: true,
      }),
    });
    if (!res.ok) {
      throw new Error(`nofluff fetch failed: ${res.status}`);
    }
    return pickArray(await res.json(), ["postings", "data", "items"]);
  },
  normalize,
};
