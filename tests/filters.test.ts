import { expect, test } from "vitest";
import { DEFAULT_FILTERS, sanitizeTrackFilter } from "@/lib/filter-defaults";
import { isInstantReject, matchesCriteria } from "@/lib/filters";
import type { FilterInput, TrackFilter } from "@/types/job";

const baseA: FilterInput = {
  title: "Senior Frontend Engineer",
  company: "Acme",
  description: "React TypeScript fully remote CET",
  location: "European Union",
  tags: ["react", "typescript", "remote"],
  track: "A",
  contractType: null,
  timezone: "CET",
};

test("default A accepts clean remote senior FE", () => {
  expect(isInstantReject(baseA, DEFAULT_FILTERS.A)).toBe(false);
  expect(matchesCriteria(baseA, DEFAULT_FILTERS.A)).toBe(true);
});

test("default A excludes hybrid / on-site / 3 days", () => {
  expect(
    isInstantReject({ ...baseA, description: "hybrid 3 days in office" }, DEFAULT_FILTERS.A),
  ).toBe(true);
  expect(isInstantReject({ ...baseA, location: "on-site Warsaw" }, DEFAULT_FILTERS.A)).toBe(true);
});

test("default A rejects when a required group is unmet", () => {
  expect(
    matchesCriteria({ ...baseA, title: "Backend Dev", tags: ["java"], description: "Java remote" }, DEFAULT_FILTERS.A),
  ).toBe(false);
});

test("default B accepts polish b2b remote senior react", () => {
  const b: FilterInput = {
    ...baseA,
    track: "B",
    title: "React Developer",
    tags: ["react"],
    description: "senior fully remote",
    location: "Poland",
    contractType: "b2b",
  };
  expect(matchesCriteria(b, DEFAULT_FILTERS.B)).toBe(true);
  expect(matchesCriteria({ ...b, location: "European Union", description: "senior remote" }, DEFAULT_FILTERS.B)).toBe(false);
  expect(matchesCriteria({ ...b, contractType: null, description: "senior fully remote uop" }, DEFAULT_FILTERS.B)).toBe(false);
});

test("empty requiredGroups accepts everything; a group with only an exclude match rejects", () => {
  const acceptAll: TrackFilter = { requiredGroups: [], exclude: [] };
  expect(matchesCriteria({ ...baseA, title: "anything" }, acceptAll)).toBe(true);
  const excludeInterns: TrackFilter = { requiredGroups: [], exclude: ["intern"] };
  expect(isInstantReject({ ...baseA, title: "Intern" }, excludeInterns)).toBe(true);
});

test("sanitizeTrackFilter drops empty keywords and empty groups", () => {
  const dirty: TrackFilter = {
    requiredGroups: [
      { label: " Stack ", keywords: [" react ", "", "  "] },
      { label: "Empty", keywords: ["", "  "] },
    ],
    exclude: ["hybrid", "", " "],
  };
  expect(sanitizeTrackFilter(dirty)).toEqual({
    requiredGroups: [{ label: "Stack", keywords: ["react"] }],
    exclude: ["hybrid"],
  });
});
