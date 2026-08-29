import type { FilterInput, TrackFilter } from "@/types/job";

function haystack(input: FilterInput): string {
  return [
    input.title,
    input.company,
    input.description,
    input.location,
    input.tags.join(" "),
    input.contractType ?? "",
    input.timezone ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function isInstantReject(
  input: FilterInput,
  filter: TrackFilter,
): boolean {
  const h = haystack(input);
  return filter.exclude.some((k) => k !== "" && h.includes(k.toLowerCase()));
}

export function matchesCriteria(
  input: FilterInput,
  filter: TrackFilter,
): boolean {
  const h = haystack(input);
  return filter.requiredGroups.every((group) =>
    group.keywords.some((k) => k !== "" && h.includes(k.toLowerCase())),
  );
}
