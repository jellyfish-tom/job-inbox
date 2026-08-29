import type { NormalizedJob } from "@/types/job";
import type { SourceAdapter } from "./types";

type JungleRaw = {
  id?: string;
  name?: string;
  company?: { name?: string };
  urls?: { show?: string };
  published_at?: string;
  skills?: string[];
  contract_type?: string;
};

type JobPostingLd = {
  "@type"?: string | string[];
  identifier?: string | { value?: string };
  title?: string;
  hiringOrganization?: { name?: string };
  url?: string;
  datePosted?: string;
  skills?: string | string[];
  employmentType?: string;
};

const LISTINGS_URL =
  "https://www.welcometothejungle.com/en/jobs?query=frontend%20senior&refinementList%5Boffices.country_code%5D%5B%5D=remote";

function isJobPosting(node: JobPostingLd): boolean {
  const type = node["@type"];
  if (type === "JobPosting") {
    return true;
  }
  return Array.isArray(type) && type.includes("JobPosting");
}

function collectJobPostings(parsed: unknown): JobPostingLd[] {
  const results: JobPostingLd[] = [];
  const nodes = Array.isArray(parsed) ? parsed : [parsed];
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const record = node as JobPostingLd & { "@graph"?: JobPostingLd[] };
    if (isJobPosting(record)) {
      results.push(record);
    }
    if (Array.isArray(record["@graph"])) {
      for (const child of record["@graph"]) {
        if (isJobPosting(child)) {
          results.push(child);
        }
      }
    }
  }
  return results;
}

export function parseJobPostingNodes(html: string): JobPostingLd[] {
  const results: JobPostingLd[] = [];
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      results.push(...collectJobPostings(JSON.parse(match[1])));
    } catch {
      // skip invalid JSON-LD blocks
    }
  }
  return results;
}

function toJungleRaw(posting: JobPostingLd): JungleRaw {
  const identifier = posting.identifier;
  const id =
    typeof identifier === "string"
      ? identifier
      : (identifier?.value ?? posting.url ?? "");

  const skills = posting.skills;
  const skillList = Array.isArray(skills)
    ? skills
    : skills
      ? [skills]
      : [];

  return {
    id,
    name: posting.title,
    company: { name: posting.hiringOrganization?.name },
    urls: { show: posting.url },
    published_at: posting.datePosted,
    skills: skillList,
    contract_type: posting.employmentType,
  };
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
    url,
    title: item.name,
    company: item.company?.name ?? "",
    track: "A",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryRaw: null,
    hardRequired: item.skills ?? [],
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: JSON.stringify(raw),
    postedAt: item.published_at ?? null,
  };
}

export const jungle: SourceAdapter = {
  source: "jungle",
  async fetchListings() {
    const res = await fetch(LISTINGS_URL, {
      headers: { "User-Agent": "job-inbox/0.1" },
    });
    if (!res.ok) {
      throw new Error(`jungle fetch failed: ${res.status}`);
    }
    const postings = parseJobPostingNodes(await res.text());
    if (postings.length === 0) {
      throw new Error("unparseable listing");
    }
    return postings.map(toJungleRaw);
  },
  normalize,
};
