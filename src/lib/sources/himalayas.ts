import type { NormalizedJob, SourceCapabilities, SourceFilter } from "@/types/job";
import { requireUrl } from "@/lib/url";
import { joinFilterTokens, type SourceAdapter } from "./types";

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
  seniority?: string[];
  employmentType?: string;
};

const TITLE_PREFIX = /^(senior|junior|jr|mid|staff|principal|remote|lead)-/i;
const ROLE_SUFFIX =
  /(engineer|developer|designer|manager|specialist|architect|lead|jobs)$/i;
const SKILL_SUFFIX = /-(development|engineering)$/i;

export const himalayasCapabilities: SourceCapabilities = {
  source: "himalayas",
  fields: [
    {
      id: "q",
      label: "Search",
      kind: "fetch",
      valueType: "tokens",
      queryKey: "q",
    },
    {
      id: "seniority",
      label: "Seniority",
      kind: "fetch",
      valueType: "enum",
      enumValues: [
        "Entry-level",
        "Mid-level",
        "Senior",
        "Manager",
        "Director",
        "Executive",
      ],
      queryKey: "seniority",
    },
    {
      id: "categories",
      label: "Categories",
      kind: "match",
      valueType: "tokens",
    },
    {
      id: "employmentType",
      label: "Employment type",
      kind: "match",
      valueType: "enum",
      enumValues: [
        "Full Time",
        "Part Time",
        "Contractor",
        "Temporary",
        "Intern",
        "Volunteer",
        "Other",
      ],
    },
  ],
};

function skillCategories(categories: string[]): string[] {
  return categories.filter((c) => {
    if (/[()]/.test(c) || TITLE_PREFIX.test(c)) return false;
    if (SKILL_SUFFIX.test(c)) return true;
    return !(ROLE_SUFFIX.test(c) && c.includes("-"));
  });
}

export function himalayasSearchUrl(filter: SourceFilter): string {
  const url = new URL("https://himalayas.app/jobs/api/search");
  const q = joinFilterTokens(filter.values.q);
  if (q) url.searchParams.set("q", q);
  const seniority = (filter.values.seniority ?? []).filter(Boolean).join(",");
  if (seniority) url.searchParams.set("seniority", seniority);
  url.searchParams.set("sort", "recent");
  url.searchParams.set("limit", "20");
  return url.toString();
}

export function matchFields(
  raw: unknown,
  job: NormalizedJob,
): Record<string, string[]> {
  const item = raw as HimalayasRaw;
  return {
    categories: skillCategories(item.categories ?? job.hardRequired),
    employmentType: item.employmentType ? [item.employmentType] : [],
  };
}

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
    url: requireUrl(url),
    title,
    company: item.companyName ?? "",
    description: item.description ?? "",
    location: (item.locationRestrictions ?? []).join(" "),
    contractType: item.employmentType ?? null,
    salaryMin: item.minSalary ?? null,
    salaryMax: item.maxSalary ?? null,
    salaryCurrency: item.currency ?? null,
    salaryRaw: null,
    hardRequired: skillCategories(item.categories ?? []),
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: item.pubDate ?? null,
  };
}

export const himalayasAdapter: SourceAdapter = {
  source: "himalayas",
  capabilities: himalayasCapabilities,
  async fetchListings(filter: SourceFilter) {
    const res = await fetch(himalayasSearchUrl(filter), {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (!res.ok) {
      throw new Error(`himalayas fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as { jobs?: unknown[] };
    return data.jobs ?? [];
  },
  normalize,
  matchFields,
};
