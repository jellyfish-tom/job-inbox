import { expect, test } from "vitest";
import type { JobRow } from "@/lib/db/queries";
import { filterJobs } from "@/lib/inbox-filter";
import { SOURCE_IDS } from "@/types/job";

function row(overrides: Partial<JobRow>): JobRow {
  return {
    id: "1",
    source: "remoteok",
    externalId: "e1",
    url: "https://x/1",
    title: "Senior React Engineer",
    company: "Acme",
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
  row({ id: "1", source: "remoteok", title: "Senior React Engineer" }),
  row({
    id: "2",
    source: "justjoin",
    title: "Vue Developer",
    hardRequired: ["vue"],
  }),
  row({ id: "3", source: "wwr", title: "Staff Frontend", company: "Globex" }),
];

test("all sources returns all", () => {
  expect(filterJobs(jobs, { text: "", sources: [...SOURCE_IDS] })).toHaveLength(3);
});

test("no sources returns none", () => {
  expect(filterJobs(jobs, { text: "", sources: [] })).toEqual([]);
  expect(filterJobs(jobs, { text: "react", sources: [] })).toEqual([]);
});

test("text matches title, company, and tags", () => {
  const sources = [...SOURCE_IDS];
  expect(filterJobs(jobs, { text: "react", sources }).map((j) => j.id)).toEqual(["1"]);
  expect(filterJobs(jobs, { text: "globex", sources }).map((j) => j.id)).toEqual(["3"]);
  expect(filterJobs(jobs, { text: "vue", sources }).map((j) => j.id)).toEqual(["2"]);
});

test("source filter narrows the list", () => {
  expect(
    filterJobs(jobs, { text: "", sources: ["justjoin"] }).map((j) => j.id),
  ).toEqual(["2"]);
  expect(
    filterJobs(jobs, { text: "", sources: ["remoteok"] }).map((j) => j.id),
  ).toEqual(["1"]);
});
