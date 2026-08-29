import { expect, test } from "vitest";
import { isInstantReject, matchesCriteria } from "@/lib/filters";
import type { FilterInput } from "@/types/job";

const baseA: FilterInput = {
  title: "Senior Frontend Engineer",
  company: "Acme",
  description: "React TypeScript remote CET",
  location: "European Union",
  tags: ["react", "typescript", "remote"],
  track: "A",
  contractType: null,
  timezone: "CET",
};

test("keeps clean remote senior FE", () => {
  expect(isInstantReject(baseA)).toBe(false);
  expect(matchesCriteria(baseA)).toBe(true);
});

test("rejects hybrid / office / 3 days", () => {
  expect(isInstantReject({ ...baseA, description: "hybrid 3 days in office" })).toBe(true);
  expect(isInstantReject({ ...baseA, location: "on-site Warsaw" })).toBe(true);
});

test("rejects US-only / UK-only without EU", () => {
  expect(isInstantReject({ ...baseA, location: "US only" })).toBe(true);
  expect(isInstantReject({ ...baseA, description: "United States only" })).toBe(true);
  expect(isInstantReject({ ...baseA, location: "UK only" })).toBe(true);
});

test("rejects Pacific-only hours", () => {
  expect(isInstantReject({ ...baseA, description: "PST only core hours" })).toBe(true);
  expect(isInstantReject({ ...baseA, timezone: "Pacific time only" })).toBe(true);
});

test("rejects nameless agency", () => {
  expect(
    isInstantReject({
      ...baseA,
      company: "TalentBridge",
      title: "Senior Frontend for our client",
      description: "confidential client",
    }),
  ).toBe(true);
});

test("track A requires seniority + FE/React + remote", () => {
  expect(matchesCriteria({ ...baseA, title: "Junior React Dev", tags: ["react"] })).toBe(false);
  expect(matchesCriteria({ ...baseA, title: "Senior Backend", tags: ["java"], description: "Java" })).toBe(false);
});

test("track B requires React/TS, senior, remote, B2B when contract present", () => {
  const b: FilterInput = {
    ...baseA,
    track: "B",
    title: "React Developer",
    tags: ["react"],
    description: "senior fully remote B2B",
    location: "Poland",
    contractType: "b2b",
  };
  expect(matchesCriteria(b)).toBe(true);
  expect(matchesCriteria({ ...b, contractType: "uop" })).toBe(false);
  expect(matchesCriteria({ ...b, location: "Warsaw onsite", description: "office" })).toBe(false);
});
