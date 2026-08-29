import type { Track, TrackFilter } from "@/types/job";

// Bilingual PL/EN. Polish stems exploit substring matching so one entry
// covers inflections: "zdaln" → zdalnie/zdalna/zdalny, "stacjonarn" →
// stacjonarna/stacjonarnie, "hybryd" → hybryda/hybrydowo.
const EXCLUDE = [
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

const REMOTE = ["remote", "fully remote", "zdaln", "w pełni zdalnie"];
const SENIORITY = ["senior", "staff", "lead", "principal", "starszy"];

export const DEFAULT_FILTERS: Record<Track, TrackFilter> = {
  A: {
    requiredGroups: [
      { label: "Remote", keywords: [...REMOTE] },
      { label: "Stack", keywords: ["react", "typescript", "frontend"] },
      { label: "Seniority", keywords: [...SENIORITY] },
    ],
    exclude: [...EXCLUDE],
  },
  B: {
    requiredGroups: [
      { label: "Stack", keywords: ["react", "typescript"] },
      { label: "Seniority", keywords: [...SENIORITY] },
      { label: "Remote", keywords: [...REMOTE] },
      { label: "Location", keywords: ["poland", "polska", "polsce", "eu remote"] },
      { label: "Contract", keywords: ["b2b", "kontrakt", "contract"] },
    ],
    exclude: [...EXCLUDE],
  },
};

export function sanitizeTrackFilter(config: TrackFilter): TrackFilter {
  const requiredGroups = config.requiredGroups
    .map((group) => ({
      label: group.label.trim(),
      keywords: group.keywords.map((k) => k.trim()).filter((k) => k !== ""),
    }))
    .filter((group) => group.keywords.length > 0);

  const exclude = config.exclude.map((k) => k.trim()).filter((k) => k !== "");

  return { requiredGroups, exclude };
}
