import type { FilterInput } from "@/types/job";

const INSTANT_REJECT_SUBSTRINGS = [
  "hybrid",
  "on-site",
  "onsite",
  "office days",
  "us only",
  "united states only",
  "uk only",
  "pst only",
  "pt hours",
  "pacific time only",
];

const INSTANT_REJECT_REGEXES = [/\b3 days\b/, /\b2 days in\b/];

function haystack(input: FilterInput): string {
  return [
    input.title,
    input.company,
    input.description,
    input.location,
    input.tags.join(" "),
    input.timezone ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function isInstantReject(input: FilterInput): boolean {
  const h = haystack(input);

  if (
    INSTANT_REJECT_SUBSTRINGS.some((p) => h.includes(p)) ||
    INSTANT_REJECT_REGEXES.some((r) => r.test(h))
  ) {
    return true;
  }

  const titleCompany = `${input.title} ${input.company}`;
  if (
    /for our client/i.test(titleCompany) &&
    /confidential client/i.test(input.description)
  ) {
    return true;
  }

  return false;
}

function hasRemote(h: string): boolean {
  return (
    h.includes("remote") ||
    h.includes("fully remote") ||
    h.includes("w pełni zdalnie")
  );
}

function hasSeniority(h: string): boolean {
  return /\b(senior|staff|lead|principal)\b/i.test(h);
}

function hasReactOrTs(h: string): boolean {
  return h.includes("react") || h.includes("typescript");
}

function matchesTrackA(input: FilterInput, h: string): boolean {
  if (!hasRemote(h)) return false;

  const title = input.title.toLowerCase();
  const titlePatterns = [
    "senior frontend",
    "staff frontend",
    "frontend engineer",
    "frontend team lead",
  ];
  if (titlePatterns.some((p) => title.includes(p))) return true;

  return hasReactOrTs(h) && hasSeniority(h);
}

function matchesTrackB(input: FilterInput, h: string): boolean {
  if (!hasReactOrTs(h)) return false;
  if (!hasSeniority(h)) return false;
  if (!hasRemote(h)) return false;

  const locationHaystack = `${input.location} ${h}`.toLowerCase();
  if (
    !locationHaystack.includes("poland") &&
    !locationHaystack.includes("polska") &&
    !locationHaystack.includes("eu remote")
  ) {
    return false;
  }

  if (input.contractType !== null) {
    if (!/b2b|kontrakt|contract/i.test(input.contractType)) {
      return false;
    }
  }

  return true;
}

export function matchesCriteria(input: FilterInput): boolean {
  const h = haystack(input);

  if (input.track === "A") {
    return matchesTrackA(input, h);
  }

  if (input.track === "B") {
    return matchesTrackB(input, h);
  }

  const _exhaustive: never = input.track;
  return _exhaustive;
}
