import type { MatchInput, SourceCapabilities, SourceFilter } from "@/types/job";

const SENTINELS = new Set(["any"]);

function isAbsentOrAny(values: string[]): boolean {
  if (values.length === 0) return true;
  return values.every((v) => SENTINELS.has(v.trim().toLowerCase()));
}

function excludeHaystack(input: MatchInput): string {
  return [input.title, input.description, ...input.tags].join(" ").toLowerCase();
}

export function isExcluded(input: MatchInput, exclude: string[]): boolean {
  const h = excludeHaystack(input);
  return exclude.some((k) => k !== "" && h.includes(k.toLowerCase()));
}

export function fieldMatches(
  listing: string[],
  required: string[],
): boolean {
  if (required.length === 0) return true;
  if (isAbsentOrAny(listing)) return true;
  return required.some((token) =>
    listing.some((value) =>
      value.toLowerCase().includes(token.toLowerCase()),
    ),
  );
}

export function matchesSource(
  input: MatchInput,
  filter: SourceFilter,
  capabilities: SourceCapabilities,
): boolean {
  if (isExcluded(input, filter.exclude)) return false;
  return capabilities.fields
    .filter((field) => field.kind !== "fetch")
    .every((field) =>
      fieldMatches(input.fields[field.id] ?? [], filter.values[field.id] ?? []),
    );
}

export function toMatchInput(
  title: string,
  description: string,
  tags: string[],
  fields: Record<string, string[]>,
): MatchInput {
  return { title, description, tags, fields };
}
