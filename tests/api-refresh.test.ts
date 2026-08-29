import { expect, test } from "vitest";
import { authorizeRefresh, parseSourceParam } from "@/lib/refresh-http";

const sources = [
  "jungle",
  "himalayas",
  "wwr",
  "justjoin",
  "nofluff",
  "remoteok",
] as const;

test("authorizeRefresh accepts matching bearer", () => {
  expect(authorizeRefresh("Bearer test-secret", "test-secret")).toBe(true);
});

test("authorizeRefresh rejects missing or wrong bearer", () => {
  expect(authorizeRefresh(null, "test-secret")).toBe(false);
  expect(authorizeRefresh("Bearer wrong", "test-secret")).toBe(false);
  expect(authorizeRefresh("test-secret", "test-secret")).toBe(false);
});

test("parseSourceParam accepts all six sources", () => {
  for (const source of sources) {
    expect(parseSourceParam(source)).toBe(source);
  }
});

test("parseSourceParam rejects unknown or missing source", () => {
  expect(parseSourceParam(null)).toBe(null);
  expect(parseSourceParam("")).toBe(null);
  expect(parseSourceParam("linkedin")).toBe(null);
});
