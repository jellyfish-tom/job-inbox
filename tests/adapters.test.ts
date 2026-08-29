import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { normalize as normalizeHimalayas } from "@/lib/sources/himalayas";
import { normalize as normalizeJustjoin } from "@/lib/sources/justjoin";
import { normalize as normalizeJungle } from "@/lib/sources/jungle";
import { normalize as normalizeNofluff } from "@/lib/sources/nofluff";
import { normalize as normalizeRemoteok } from "@/lib/sources/remoteok";
import { normalize as normalizeWwr, parseRssItems } from "@/lib/sources/wwr";
import { getAdapter } from "@/lib/sources/registry";

const fx = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests/fixtures", name), "utf8");

test("himalayas maps salary, url, track A, skills from categories", () => {
  const raw = JSON.parse(fx("himalayas-one.json"));
  const job = normalizeHimalayas(raw);
  expect(job.source).toBe("himalayas");
  expect(job.externalId).toBe(raw.guid);
  expect(job.url).toBe(raw.applicationLink);
  expect(job.company).toBe("Acme");
  expect(job.track).toBe("A");
  expect(job.salaryMin).toBe(80000);
  expect(job.salaryMax).toBe(120000);
  expect(job.salaryCurrency).toBe("USD");
  expect(job.hardRequired).toEqual(["React", "TypeScript"]);
  expect(job.postedAt).toBe("2026-08-28T00:00:00.000Z");
  expect(JSON.parse(job.rawJson).guid).toBe(raw.guid);
});

test("remoteok skips nothing and uses id + url", () => {
  const raw = JSON.parse(fx("remoteok-one.json"));
  const job = normalizeRemoteok(raw);
  expect(job.source).toBe("remoteok");
  expect(job.externalId).toBe("1137001");
  expect(job.title).toBe("Senior Frontend Engineer");
  expect(job.salaryRaw).toBe("90–140");
  expect(job.hardRequired).toEqual(["react", "typescript"]);
});

test("remoteok legal notice object throws", () => {
  expect(() => normalizeRemoteok({ last_updated: 1, legal: "x" })).toThrow(
    /unparseable listing/,
  );
});

test("wwr splits Company: Role and parses RSS", () => {
  const items = parseRssItems(fx("wwr-sample.xml"));
  expect(items).toHaveLength(1);
  const job = normalizeWwr(items[0]);
  expect(job.source).toBe("wwr");
  expect(job.company).toBe("Acme");
  expect(job.title).toBe("Senior Frontend Engineer");
  expect(job.url).toContain("weworkremotely.com");
  expect(job.track).toBe("A");
});

test("justjoin track B salary and skills", () => {
  const job = normalizeJustjoin(JSON.parse(fx("justjoin-one.json")));
  expect(job.source).toBe("justjoin");
  expect(job.track).toBe("B");
  expect(job.url).toBe("https://justjoin.it/job-offer/jj-1");
  expect(job.salaryMin).toBe(20000);
  expect(job.hardRequired).toEqual(["React", "TypeScript"]);
});

test("nofluff splits must/nice", () => {
  const job = normalizeNofluff(JSON.parse(fx("nofluff-one.json")));
  expect(job.hardRequired).toEqual(["TypeScript"]);
  expect(job.hardNice).toEqual(["Playwright"]);
  expect(job.track).toBe("B");
});

test("jungle track A", () => {
  const job = normalizeJungle(JSON.parse(fx("jungle-one.json")));
  expect(job.source).toBe("jungle");
  expect(job.externalId).toBe("wttj-1");
  expect(job.url).toContain("welcometothejungle.com");
  expect(job.track).toBe("A");
});

test("registry returns six adapters and rejects unknown", () => {
  for (const s of ["jungle", "himalayas", "wwr", "justjoin", "nofluff", "remoteok"] as const) {
    expect(getAdapter(s).source).toBe(s);
  }
  expect(() => getAdapter("linkedin" as never)).toThrow(/unknown source/);
});
