import type { NormalizedJob, SourceCapabilities, SourceFilter } from "@/types/job";
import { pickArray } from "./parse";
import { nonempty, type SourceAdapter } from "./types";

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
  experienceLevel?: string;
};

const LISTINGS_URL = "https://justjoin.it/api/candidate-api/offers";
const PAGE_SIZE = 100;
const MAX_PAGES = 3;

export const justjoinCapabilities: SourceCapabilities = {
  source: "justjoin",
  fields: [
    {
      id: "skills",
      label: "Skills",
      kind: "both",
      valueType: "tokens",
      queryKey: "skills",
    },
    {
      id: "experienceLevels",
      label: "Experience",
      kind: "fetch",
      valueType: "enum",
      enumValues: ["junior", "mid", "senior", "c_level"],
      queryKey: "experienceLevels",
    },
    {
      id: "workplaceType",
      label: "Workplace",
      kind: "match",
      valueType: "enum",
      enumValues: ["remote", "hybrid", "office"],
    },
    {
      id: "employmentTypes",
      label: "Contract",
      kind: "match",
      valueType: "enum",
      enumValues: ["b2b", "permanent", "mandate_contract"],
    },
  ],
};

export function parseJustjoinPage(data: unknown): {
  items: unknown[];
  nextFrom: number | null;
} {
  const items = pickArray(data, ["data", "offers", "items"]);
  const cursor = (data as { meta?: { next?: { cursor?: unknown } } })?.meta
    ?.next?.cursor;
  return {
    items,
    nextFrom: typeof cursor === "number" ? cursor : null,
  };
}

export function justjoinOffersUrl(
  from: number,
  skill: string | undefined,
  experienceLevel: string | undefined,
): string {
  const url = new URL(LISTINGS_URL);
  if (skill) url.searchParams.set("skills", skill);
  if (experienceLevel) url.searchParams.set("experienceLevels", experienceLevel);
  url.searchParams.set("from", String(from));
  url.searchParams.set("itemsCount", String(PAGE_SIZE));
  return url.toString();
}

function skillNames(item: JustjoinRaw): string[] {
  return (item.requiredSkills ?? [])
    .map((skill) => skill.name)
    .filter((name): name is string => Boolean(name));
}

export function matchFields(
  raw: unknown,
  job: NormalizedJob,
): Record<string, string[]> {
  const item = raw as JustjoinRaw;
  const types = [
    ...new Set(
      (item.employmentTypes ?? [])
        .map((e) => e.type)
        .filter((t): t is string => Boolean(t)),
    ),
  ];
  return {
    skills: skillNames(item).length ? skillNames(item) : job.hardRequired,
    experienceLevels: item.experienceLevel ? [item.experienceLevel] : [],
    workplaceType: item.workplaceType ? [item.workplaceType] : [],
    employmentTypes: types,
  };
}

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
    description: "",
    location: item.workplaceType ?? "",
    contractType: employment?.type ?? null,
    salaryMin: employment?.from ?? null,
    salaryMax: employment?.to ?? null,
    salaryCurrency: employment?.currency ?? null,
    salaryRaw: null,
    hardRequired: skillNames(item),
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: item.publishedAt ?? null,
  };
}

async function fetchSkillPages(
  skill: string | undefined,
  experienceLevel: string | undefined,
): Promise<unknown[]> {
  const listings: unknown[] = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(justjoinOffersUrl(from, skill, experienceLevel), {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (!res.ok) {
      throw new Error(`justjoin fetch failed: ${res.status}`);
    }
    const { items, nextFrom } = parseJustjoinPage(await res.json());
    listings.push(...items);
    if (nextFrom == null || items.length === 0) break;
    from = nextFrom;
  }
  return listings;
}

export const justjoin: SourceAdapter = {
  source: "justjoin",
  capabilities: justjoinCapabilities,
  async fetchListings(filter: SourceFilter) {
    const skills = nonempty(filter.values.skills);
    const levels = nonempty(filter.values.experienceLevels);
    const skillKeys = skills.length > 0 ? skills : [undefined];
    const levelKeys = levels.length > 0 ? levels : [undefined];
    const seen = new Set<string>();
    const listings: unknown[] = [];
    for (const skill of skillKeys) {
      for (const level of levelKeys) {
        for (const item of await fetchSkillPages(skill, level)) {
          const guid = (item as { guid?: string }).guid;
          if (guid) {
            if (seen.has(guid)) continue;
            seen.add(guid);
          }
          listings.push(item);
        }
      }
    }
    return listings;
  },
  normalize,
  matchFields,
};
