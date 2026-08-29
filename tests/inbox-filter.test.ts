import { expect, test } from "vitest";
import type { JobRow } from "@/lib/db/queries";
import { filterJobs } from "@/lib/inbox-filter";

function row(overrides: Partial<JobRow>): JobRow {
  return {
    id: "1",
    source: "remoteok",
    externalId: "e1",
    url: "https://x/1",
    title: "Senior React Engineer",
    company: "Acme",
    track: "A",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryRaw: null,
    hardRequired: ["typescript"],
    hardNice: [],
    softRequired: [],
    softNice: [],
    rawJson: "{}",
    postedAt: null,
    status: "new",
    appliedAt: null,
    notes: "",
    firstSeenAt: "2026-08-29T00:00:00.000Z",
    lastSeenAt: "2026-08-29T00:00:00.000Z",
    ...overrides,
  };
}

const jobs: JobRow[] = [
  row({ id: "1", source: "remoteok", track: "A", title: "Senior React Engineer" }),
  row({ id: "2", source: "justjoin", track: "B", title: "Vue Developer", hardRequired: ["vue"] }),
  row({ id: "3", source: "wwr", track: "A", title: "Staff Frontend", company: "Globex" }),
];

test("empty query returns all", () => {
  expect(filterJobs(jobs, { text: "", sources: [], tracks: [] })).toHaveLength(3);
});

test("text matches title, company, and tags", () => {
  expect(filterJobs(jobs, { text: "react", sources: [], tracks: [] }).map((j) => j.id)).toEqual(["1"]);
  expect(filterJobs(jobs, { text: "globex", sources: [], tracks: [] }).map((j) => j.id)).toEqual(["3"]);
  expect(filterJobs(jobs, { text: "vue", sources: [], tracks: [] }).map((j) => j.id)).toEqual(["2"]);
});

test("source and track filters combine (AND)", () => {
  expect(filterJobs(jobs, { text: "", sources: ["justjoin"], tracks: [] }).map((j) => j.id)).toEqual(["2"]);
  expect(filterJobs(jobs, { text: "", sources: [], tracks: ["A"] }).map((j) => j.id)).toEqual(["1", "3"]);
  expect(filterJobs(jobs, { text: "", sources: ["remoteok"], tracks: ["B"] })).toHaveLength(0);
});
