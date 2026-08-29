import type { NormalizedJob } from "@/types/job";
import { requireUrl } from "@/lib/url";
import type { SourceAdapter } from "./types";

export type RssItem = {
  title: string;
  link: string;
  pubDate: string | null;
  description: string;
};

const LISTINGS_URL =
  "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss";

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = re.exec(block);
  return match ? match[1].trim() : null;
}

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTag(block, "title") ?? "",
      link: extractTag(block, "link") ?? "",
      pubDate: extractTag(block, "pubDate"),
      description: extractTag(block, "description") ?? "",
    });
  }
  return items;
}

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as RssItem;
  const url = item.link;
  if (!item.title || !url) {
    throw new Error("unparseable listing");
  }

  const colonIdx = item.title.indexOf(": ");
  const company = colonIdx >= 0 ? item.title.slice(0, colonIdx) : "";
  const title = colonIdx >= 0 ? item.title.slice(colonIdx + 2) : item.title;

  let postedAt: string | null = null;
  if (item.pubDate) {
    const d = new Date(item.pubDate);
    if (!Number.isNaN(d.getTime())) {
      postedAt = d.toISOString();
    }
  }

  const validUrl = requireUrl(url);

  return {
    source: "wwr",
    externalId: new URL(validUrl).pathname,
    url: validUrl,
    title,
    company,
    track: "A",
    description: item.description,
    location: "",
    contractType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryRaw: null,
    hardRequired: [],
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt,
  };
}

export const wwrAdapter: SourceAdapter = {
  source: "wwr",
  async fetchListings() {
    const res = await fetch(LISTINGS_URL, {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (!res.ok) {
      throw new Error(`wwr fetch failed: ${res.status}`);
    }
    return parseRssItems(await res.text());
  },
  normalize,
};
