import { expect, test } from "vitest";
import { normalizeUrl, requireUrl } from "@/lib/url";

test("strips query, hash, trailing slash; lowercases host", () => {
  expect(
    normalizeUrl("https://WWW.Example.com/jobs/abc/?utm_source=x#x"),
  ).toBe("https://www.example.com/jobs/abc");
});

test("requireUrl passes through a valid url", () => {
  expect(requireUrl("https://example.com/jobs/1")).toBe(
    "https://example.com/jobs/1",
  );
});

test("requireUrl throws unparseable listing for junk", () => {
  expect(() => requireUrl("not a url")).toThrow(/unparseable listing/);
  expect(() => requireUrl(undefined)).toThrow(/unparseable listing/);
  expect(() => requireUrl("")).toThrow(/unparseable listing/);
});
