import type { NormalizedJob, SourceCapabilities, SourceFilter } from "@/types/job";
import { requireUrl } from "@/lib/url";
import { pickArray } from "./parse";
import { nonempty, type SourceAdapter } from "./types";

type NofluffTile = { value?: string; type?: string };

type NofluffRaw = {
  id?: string;
  reference?: string;
  title?: string;
  name?: string;
  company?: { name?: string };
  skills?: { must?: string[]; nice?: string[] };
  tiles?: { values?: NofluffTile[] };
  posted?: string | number;
  url?: string;
  remote?: string;
  fullyRemote?: boolean;
  location?: { fullyRemote?: boolean };
};

const LISTINGS_URL = "https://nofluffjobs.com/api/search/posting";

export const nofluffCapabilities: SourceCapabilities = {
  source: "nofluff",
  fields: [
    {
      id: "skills",
      label: "Skills",
      kind: "both",
      valueType: "tokens",
      queryKey: "requirement",
    },
    {
      id: "seniority",
      label: "Seniority",
      kind: "fetch",
      valueType: "enum",
      enumValues: ["Trainee", "Junior", "Mid", "Senior", "Expert"],
      queryKey: "seniority",
    },
    {
      id: "remote",
      label: "Remote",
      kind: "match",
      valueType: "enum",
      enumValues: ["fully", "hybrid", "office"],
    },
  ],
};

export function nofluffSearchUrl(): string {
  const url = new URL(LISTINGS_URL);
  url.searchParams.set("salaryCurrency", "PLN");
  url.searchParams.set("salaryPeriod", "month");
  url.searchParams.set("region", "pl");
  return url.toString();
}

export function nofluffSearchBody(filter: SourceFilter): {
  page: number;
  rawSearch: string;
  criteriaSearch: Record<string, string[]>;
} {
  const criteriaSearch: Record<string, string[]> = {};
  const requirement = nonempty(filter.values.skills);
  const seniority = nonempty(filter.values.seniority);
  if (requirement.length) criteriaSearch.requirement = requirement;
  if (seniority.length) criteriaSearch.seniority = seniority;
  return { page: 1, rawSearch: "", criteriaSearch };
}

function tileSkills(item: NofluffRaw, type: string): string[] {
  return (item.tiles?.values ?? [])
    .filter((tile) => tile.type === type && tile.value)
    .map((tile) => tile.value as string);
}

function listingKey(item: NofluffRaw): string {
  return item.reference ?? item.id ?? "";
}

function isRemoteFlavor(item: NofluffRaw): boolean {
  const slug = `${item.id ?? ""} ${item.url ?? ""}`.toLowerCase();
  return slug.includes("-remote");
}

export function dedupeNofluffPostings(items: unknown[]): unknown[] {
  const byKey = new Map<string, unknown>();
  for (const raw of items) {
    const item = raw as NofluffRaw;
    const key = listingKey(item);
    if (!key) continue;
    const current = byKey.get(key) as NofluffRaw | undefined;
    if (!current || (!isRemoteFlavor(current) && isRemoteFlavor(item))) {
      byKey.set(key, raw);
    }
  }
  return [...byKey.values()];
}

function listingUrl(item: NofluffRaw): string | undefined {
  if (!item.url) return undefined;
  if (URL.canParse(item.url)) return item.url;
  return `https://nofluffjobs.com/job/${item.url}`;
}

function remoteValue(item: NofluffRaw): string {
  if (item.remote) return item.remote;
  if (item.location?.fullyRemote || item.fullyRemote || isRemoteFlavor(item)) {
    return "fully";
  }
  if (item.id || item.url) return "office";
  return "";
}

function postedAt(value: string | number | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return value;
}

export function matchFields(
  raw: unknown,
  job: NormalizedJob,
): Record<string, string[]> {
  const item = raw as NofluffRaw;
  const remote = remoteValue(item);
  return {
    remote: remote ? [remote] : [],
    skills:
      item.skills?.must ??
      (tileSkills(item, "requirement").length
        ? tileSkills(item, "requirement")
        : job.hardRequired),
  };
}

export function normalize(raw: unknown): NormalizedJob {
  const item = raw as NofluffRaw;
  const url = listingUrl(item);
  const externalId = listingKey(item);
  if (!externalId || !item.title || !url) {
    throw new Error("unparseable listing");
  }

  const must = item.skills?.must ?? tileSkills(item, "requirement");
  const nice = item.skills?.nice ?? [];
  const remote = remoteValue(item);

  return {
    source: "nofluff",
    externalId,
    url: requireUrl(url),
    title: item.title,
    company: item.company?.name ?? item.name ?? "",
    description: "",
    location: remote === "fully" ? "remote" : remote,
    contractType: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryRaw: null,
    hardRequired: must,
    hardNice: nice,
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: postedAt(item.posted),
  };
}

export const nofluff: SourceAdapter = {
  source: "nofluff",
  capabilities: nofluffCapabilities,
  async fetchListings(filter: SourceFilter) {
    const res = await fetch(nofluffSearchUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "job-inbox/0.1",
      },
      body: JSON.stringify(nofluffSearchBody(filter)),
    });
    if (!res.ok) {
      throw new Error(`nofluff fetch failed: ${res.status}`);
    }
    return dedupeNofluffPostings(
      pickArray(await res.json(), ["postings", "data", "items"]),
    );
  },
  normalize,
  matchFields,
};
