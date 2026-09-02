import type { NormalizedJob, SourceCapabilities, SourceFilter } from "@/types/job";
import { requireUrl } from "@/lib/url";
import { joinFilterTokens, nonempty, type SourceAdapter } from "./types";

type JungleRaw = {
  id?: string;
  name?: string;
  company?: { name?: string };
  urls?: { show?: string };
  published_at?: string;
  skills?: string[];
  contract_type?: string;
  description?: string;
  workplace_type?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
};

type JungleHit = {
  objectID?: string;
  reference?: string;
  name?: string;
  slug?: string;
  organization?: { name?: string; slug?: string };
  published_at?: string;
  remote?: string;
  contract_type?: string;
  summary?: string;
  profile?: string;
  salary_minimum?: number | null;
  salary_maximum?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  new_profession?: {
    pivot_name?: string;
    sub_category_name?: string;
  };
};

const ALGOLIA_APP_ID = "CSEKHVMS53";
const ALGOLIA_API_KEY = "4bd8f6215d0cc52b26430765769e65a0";
const ALGOLIA_INDEX = "wttj_jobs_production_en";
const ALGOLIA_URL = `https://${ALGOLIA_APP_ID.toLowerCase()}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;

export const jungleCapabilities: SourceCapabilities = {
  source: "jungle",
  fields: [
    {
      id: "query",
      label: "Search",
      kind: "fetch",
      valueType: "tokens",
      queryKey: "query",
    },
    {
      id: "skills",
      label: "Skills",
      kind: "match",
      valueType: "tokens",
    },
    {
      id: "workplace_type",
      label: "Workplace",
      kind: "match",
      valueType: "tokens",
    },
  ],
};

function wantsRemote(filter: SourceFilter): boolean {
  return nonempty(filter.values.workplace_type).some((token) => {
    const value = token.toLowerCase();
    return value === "remote" || value === "telecommute" || value === "fulltime";
  });
}

export function jungleAlgoliaBody(
  filter: SourceFilter,
  page: number,
): {
  query: string;
  hitsPerPage: number;
  page: number;
  filters?: string;
} {
  const body: {
    query: string;
    hitsPerPage: number;
    page: number;
    filters?: string;
  } = {
    query: joinFilterTokens(filter.values.query),
    hitsPerPage: PAGE_SIZE,
    page,
  };
  if (wantsRemote(filter)) {
    body.filters = "remote:fulltime";
  }
  return body;
}

function listingUrl(hit: JungleHit): string | undefined {
  const org = hit.organization?.slug;
  const slug = hit.slug;
  if (!org || !slug) return undefined;
  return `https://www.welcometothejungle.com/en/companies/${org}/jobs/${slug}`;
}

export function toJungleRaw(hit: JungleHit): JungleRaw {
  const description = [hit.summary, hit.profile]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
  return {
    id: hit.reference ?? hit.objectID,
    name: hit.name,
    company: { name: hit.organization?.name },
    urls: { show: listingUrl(hit) },
    published_at: hit.published_at,
    skills: [],
    contract_type: hit.contract_type,
    description,
    workplace_type: hit.remote,
    salary_min: hit.salary_minimum,
    salary_max: hit.salary_maximum,
    salary_currency: hit.salary_currency,
    salary_period: hit.salary_period,
  };
}

export function listingsFromHits(hits: JungleHit[]): JungleRaw[] {
  const seen = new Set<string>();
  const listings: JungleRaw[] = [];
  for (const hit of hits) {
    const raw = toJungleRaw(hit);
    if (!raw.id || !raw.urls?.show || seen.has(raw.id)) continue;
    seen.add(raw.id);
    listings.push(raw);
  }
  return listings;
}

function jungleSalaryRaw(item: JungleRaw): string | null {
  const parts: string[] = [];
  if (item.salary_min != null && item.salary_min > 0) {
    parts.push(String(item.salary_min));
  }
  if (item.salary_max != null && item.salary_max > 0) {
    parts.push(String(item.salary_max));
  }
  if (parts.length === 0) return null;
  const range = parts.join("–");
  const currency = item.salary_currency ?? "";
  const period = item.salary_period ? `/ ${item.salary_period}` : "";
  return `${range} ${currency} ${period}`.replace(/\s+/g, " ").trim();
}

function displayLocation(workplace: string | undefined): string {
  if (!workplace) return "";
  if (workplace.toLowerCase() === "fulltime") return "remote";
  return workplace;
}

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as JungleRaw;
  const url = item.urls?.show;
  if (!item.id || !item.name || !url) {
    throw new Error("unparseable listing");
  }

  return {
    source: "jungle",
    externalId: item.id,
    url: requireUrl(url),
    title: item.name,
    company: item.company?.name ?? "",
    description: item.description ?? "",
    location: displayLocation(item.workplace_type),
    contractType: item.contract_type ?? null,
    salaryMin: item.salary_min ?? null,
    salaryMax: item.salary_max ?? null,
    salaryCurrency: item.salary_currency ?? null,
    salaryRaw: jungleSalaryRaw(item),
    hardRequired: item.skills ?? [],
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: item.published_at ?? null,
  };
}

export function matchFields(
  raw: unknown,
  job: NormalizedJob,
): Record<string, string[]> {
  const item = raw as JungleRaw;
  const workplace = item.workplace_type ? [item.workplace_type] : [];
  const remote = item.workplace_type?.toLowerCase();
  if (remote === "telecommute" || remote === "fulltime") {
    workplace.push("remote");
  }
  const skills = item.description
    ? [item.description]
    : item.skills && item.skills.length > 0
      ? item.skills
      : job.hardRequired;
  return {
    skills,
    workplace_type: workplace,
  };
}

async function fetchPage(filter: SourceFilter, page: number): Promise<JungleHit[]> {
  const res = await fetch(ALGOLIA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-algolia-application-id": ALGOLIA_APP_ID,
      "x-algolia-api-key": ALGOLIA_API_KEY,
      Referer: "https://www.welcometothejungle.com/",
      Origin: "https://www.welcometothejungle.com",
      "User-Agent": "job-inbox/0.1",
    },
    body: JSON.stringify(jungleAlgoliaBody(filter, page)),
  });
  if (!res.ok) {
    throw new Error(`jungle fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as { hits?: unknown };
  return Array.isArray(data.hits) ? (data.hits as JungleHit[]) : [];
}

export const jungle: SourceAdapter = {
  source: "jungle",
  capabilities: jungleCapabilities,
  async fetchListings(filter: SourceFilter) {
    const listings: JungleRaw[] = [];
    const seen = new Set<string>();
    for (let page = 0; page < MAX_PAGES; page++) {
      const hits = await fetchPage(filter, page);
      if (hits.length === 0) break;
      for (const raw of listingsFromHits(hits)) {
        if (!raw.id || seen.has(raw.id)) continue;
        seen.add(raw.id);
        listings.push(raw);
      }
      if (hits.length < PAGE_SIZE) break;
    }
    return listings;
  },
  normalize,
  matchFields,
};
