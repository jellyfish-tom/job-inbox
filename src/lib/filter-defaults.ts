import type { SourceFilter, SourceId } from "@/types/job";

export const DEFAULT_EXCLUDE = [
  "hybrid",
  "hybryd",
  "on-site",
  "onsite",
  "stacjonarn",
  "office days",
  "days in office",
  "dni w biurze",
  "w biurze",
  "us only",
  "united states only",
  "uk only",
  "pst only",
  "pt hours",
  "pacific time only",
  "3 days",
  "2 days in",
];

function filter(values: Record<string, string[]>): SourceFilter {
  return { values, exclude: [...DEFAULT_EXCLUDE] };
}

export const DEFAULT_SOURCE_FILTERS: Record<SourceId, SourceFilter> = {
  justjoin: filter({
    skills: ["React"],
    experienceLevels: ["senior"],
    workplaceType: ["remote"],
    employmentTypes: [],
  }),
  himalayas: filter({
    q: ["react"],
    seniority: ["Senior"],
    categories: ["react", "typescript", "frontend"],
  }),
  nofluff: filter({
    skills: ["React", "TypeScript"],
    seniority: ["Senior"],
    remote: ["fully"],
  }),
  jungle: filter({
    query: ["frontend senior"],
    skills: ["react", "typescript"],
    workplace_type: ["remote"],
  }),
  remoteok: filter({
    tags: ["react", "typescript"],
  }),
  wwr: filter({
    title: ["react", "typescript", "frontend", "senior"],
  }),
};

function dedupeTokens(tokens: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tokens) {
    const token = raw.trim();
    if (token === "") continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(token);
  }
  return out;
}

export function sanitizeSourceFilter(
  config: SourceFilter,
  allowedIds: string[],
): SourceFilter {
  const allowed = new Set(allowedIds);
  const values: Record<string, string[]> = {};
  for (const [id, tokens] of Object.entries(config.values ?? {})) {
    if (!allowed.has(id) || !Array.isArray(tokens)) continue;
    values[id] = dedupeTokens(tokens.filter((t) => typeof t === "string"));
  }
  return {
    values,
    exclude: dedupeTokens(
      (config.exclude ?? []).filter((t) => typeof t === "string"),
    ),
  };
}
