import { expect, test } from "vitest";
import { normalizeUrl } from "@/lib/url";

test("strips query, hash, trailing slash; lowercases host", () => {
  expect(
    normalizeUrl("https://WWW.Example.com/jobs/abc/?utm_source=x#x"),
  ).toBe("https://www.example.com/jobs/abc");
});
