import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import {
  himalayasSearchUrl,
  matchFields as matchHimalayas,
  normalize as normalizeHimalayas,
} from "@/lib/sources/himalayas";
import {
  justjoinOffersUrl,
  matchFields as matchJustjoin,
  normalize as normalizeJustjoin,
  parseJustjoinPage,
} from "@/lib/sources/justjoin";
import {
  jungleAlgoliaBody,
  listingsFromHits,
  matchFields as matchJungle,
  normalize as normalizeJungle,
  toJungleRaw,
} from "@/lib/sources/jungle";
import {
  dedupeNofluffPostings,
  matchFields as matchNofluff,
  nofluffSearchBody,
  nofluffSearchUrl,
  normalize as normalizeNofluff,
} from "@/lib/sources/nofluff";
import {
  normalize as normalizeRemoteok,
  remoteokApiUrl,
} from "@/lib/sources/remoteok";
import {
  matchFields as matchWwr,
  normalize as normalizeWwr,
  parseRssItems,
} from "@/lib/sources/wwr";
import { getAdapter } from "@/lib/sources/registry";

const fx = (name: string) =>
  readFileSync(path.join(process.cwd(), "tests/fixtures", name), "utf8");

test("himalayas rejects non-url guid used as url", () => {
  expect(() =>
    normalizeHimalayas({ title: "x", guid: "not a url" }),
  ).toThrow(/unparseable listing/);
});

test("himalayas hardRequired keeps skill categories and drops job-title slugs", () => {
  const raw = JSON.parse(fx("himalayas-one.json"));
  const job = normalizeHimalayas({
    ...raw,
    categories: [
      "Frontend-Engineer",
      "React",
      "TypeScript-Development",
      "Remote-Senior-Frontend-Developer-(TypeScript-NextJS)",
      "Senior-Frontend-React-Developer",
      "Software-Engineer",
      "Frontend-Development",
    ],
  });
  expect(job.hardRequired).toEqual([
    "React",
    "TypeScript-Development",
    "Frontend-Development",
  ]);
});

test("himalayas maps salary, url, skills from categories", () => {
  const raw = JSON.parse(fx("himalayas-one.json"));
  const job = normalizeHimalayas(raw);
  expect(job.source).toBe("himalayas");
  expect(job.externalId).toBe(raw.guid);
  expect(job.url).toBe(raw.applicationLink);
  expect(job.company).toBe("Acme");
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

test("remoteok fetch URL sends configured tags", () => {
  expect(
    remoteokApiUrl({
      values: { tags: ["react", "typescript"] },
      exclude: [],
    }),
  ).toBe("https://remoteok.com/api?tags=react%2Ctypescript");
  expect(remoteokApiUrl({ values: {}, exclude: [] })).toBe(
    "https://remoteok.com/api",
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
  expect(matchWwr(items[0], job).title).toEqual([
    "Senior Frontend Engineer",
    "frontend",
  ]);
});

test("justjoin page parser reads data and next cursor", () => {
  expect(
    parseJustjoinPage({
      data: [{ guid: "1" }],
      meta: { next: { cursor: 100, itemsCount: 100 } },
    }),
  ).toEqual({ items: [{ guid: "1" }], nextFrom: 100 });
  expect(parseJustjoinPage({ data: [] })).toEqual({ items: [], nextFrom: null });
});

test("justjoin salary and skills", () => {
  const job = normalizeJustjoin(JSON.parse(fx("justjoin-one.json")));
  expect(job.source).toBe("justjoin");
  expect(job.url).toBe(
    "https://justjoin.it/job-offer/polishco-senior-react-developer",
  );
  expect(job.salaryMin).toBe(20000);
  expect(job.hardRequired).toEqual(["React", "TypeScript"]);
});

test("nofluff splits must/nice", () => {
  const job = normalizeNofluff(JSON.parse(fx("nofluff-one.json")));
  expect(job.hardRequired).toEqual(["TypeScript"]);
  expect(job.hardNice).toEqual(["Playwright"]);
});

test("jungle source and url", () => {
  const job = normalizeJungle(JSON.parse(fx("jungle-one.json")));
  expect(job.source).toBe("jungle");
  expect(job.externalId).toBe("wttj-1");
  expect(job.url).toContain("welcometothejungle.com");
});

test("jungle algolia query uses search tokens and remote filter", () => {
  expect(
    jungleAlgoliaBody(
      {
        values: { query: ["frontend senior"], workplace_type: ["remote"] },
        exclude: [],
      },
      0,
    ),
  ).toEqual({
    query: "frontend senior",
    hitsPerPage: 100,
    page: 0,
    filters: "remote:fulltime",
  });
});

test("jungle maps algolia hit to listing url", () => {
  const raw = toJungleRaw({
    reference: "hit-1",
    name: "Senior Frontend Engineer",
    slug: "senior-frontend-engineer_paris",
    organization: { name: "Acme", slug: "acme" },
    remote: "fulltime",
    contract_type: "full_time",
    summary: "React TypeScript",
    profile: "Need React",
    salary_minimum: 120000,
    salary_maximum: 160000,
    salary_currency: "USD",
    salary_period: "yearly",
    new_profession: {
      pivot_name: "Front-End Developer",
      sub_category_name: "Software & Web Development",
    },
  });
  const job = normalizeJungle(raw);
  expect(job.externalId).toBe("hit-1");
  expect(job.url).toBe(
    "https://www.welcometothejungle.com/en/companies/acme/jobs/senior-frontend-engineer_paris",
  );
  expect(job.company).toBe("Acme");
  expect(job.location).toBe("remote");
  expect(job.hardRequired).toEqual([]);
  expect(job.salaryRaw).toBe("120000–160000 USD / yearly");
  expect(matchJungle(raw, job)).toEqual({
    skills: ["React TypeScript\n\nNeed React"],
    workplace_type: ["fulltime", "remote"],
  });
});

test("jungle skips hits that cannot build a listing url", () => {
  const kept = listingsFromHits([
    {
      reference: "ok",
      name: "Kept",
      slug: "kept",
      organization: { slug: "acme" },
    },
    { objectID: "no-url", name: "Broken" },
    { reference: "ok", name: "dup", slug: "kept", organization: { slug: "acme" } },
  ]);
  expect(kept).toHaveLength(1);
  expect(kept[0].id).toBe("ok");
});

test("registry returns six adapters and rejects unknown", () => {
  for (const s of ["jungle", "himalayas", "wwr", "justjoin", "nofluff", "remoteok"] as const) {
    expect(getAdapter(s).source).toBe(s);
  }
  expect(() => getAdapter("linkedin" as never)).toThrow(/unknown source/);
});

test("himalayas populates filter fields from description and locationRestrictions", () => {
  const job = normalizeHimalayas(JSON.parse(fx("himalayas-one.json")));
  expect(job.description).toBe("React TypeScript remote");
  expect(job.location).toBe("Poland Germany");
  expect(job.contractType).toBeNull();
});

test("remoteok populates description", () => {
  const job = normalizeRemoteok(JSON.parse(fx("remoteok-one.json")));
  expect(job.description).toBe("React TypeScript");
});

test("wwr populates description from RSS body", () => {
  const items = parseRssItems(fx("wwr-sample.xml"));
  expect(normalizeWwr(items[0]).description).toBe("React TypeScript remote CET");
});

test("justjoin maps workplaceType and contract into filter fields", () => {
  const job = normalizeJustjoin(JSON.parse(fx("justjoin-one.json")));
  expect(job.location).toBe("remote");
  expect(job.contractType).toBe("b2b");
});

test("nofluff marks fully-remote listings", () => {
  const job = normalizeNofluff(JSON.parse(fx("nofluff-one.json")));
  expect(job.location).toBe("remote");
});

test("nofluff search uses salaryCurrency query and criteriaSearch body", () => {
  expect(nofluffSearchUrl()).toContain("salaryCurrency=PLN");
  expect(
    nofluffSearchBody({
      values: { skills: ["React", "TypeScript"], seniority: ["Senior"] },
      exclude: [],
    }),
  ).toEqual({
    page: 1,
    rawSearch: "",
    criteriaSearch: {
      requirement: ["React", "TypeScript"],
      seniority: ["Senior"],
    },
  });
});

test("nofluff normalize accepts slug url and tiles", () => {
  const job = normalizeNofluff({
    id: "nf-slug",
    title: "Senior React",
    name: "PolishCo",
    url: "senior-react-polishco-remote",
    location: { fullyRemote: true },
    tiles: {
      values: [
        { value: "React", type: "requirement" },
        { value: "frontend", type: "category" },
      ],
    },
    posted: 1788040834250,
  });
  expect(job.url).toBe("https://nofluffjobs.com/job/senior-react-polishco-remote");
  expect(job.company).toBe("PolishCo");
  expect(job.hardRequired).toEqual(["React"]);
  expect(job.location).toBe("remote");
});

test("nofluff remote field uses slug when tiles omit fullyRemote", () => {
  const remote = {
    id: "vidoc-Remote",
    title: "Founding Engineer",
    url: "vidoc-remote",
  };
  const office = {
    id: "astek-Kraków",
    title: "Java React",
    url: "astek-krakow",
  };
  expect(matchNofluff(remote, normalizeNofluff(remote)).remote).toEqual([
    "fully",
  ]);
  expect(matchNofluff(office, normalizeNofluff(office)).remote).toEqual([
    "office",
  ]);
});

test("nofluff collapses city flavors onto reference and prefers remote", () => {
  const kept = dedupeNofluffPostings([
    {
      id: "vidoc-warszawa",
      reference: "LZGAZZ3V",
      title: "Founding Engineer",
      url: "vidoc-warszawa",
    },
    {
      id: "vidoc-Remote",
      reference: "LZGAZZ3V",
      title: "Founding Engineer",
      url: "vidoc-remote",
    },
    {
      id: "iteamly-krakow",
      reference: "DXYXVVP5",
      title: "Senior FullStack",
      url: "iteamly-krakow",
    },
  ]);
  expect(kept).toHaveLength(2);
  expect(normalizeNofluff(kept[0]).externalId).toBe("LZGAZZ3V");
  expect(normalizeNofluff(kept[0]).url).toContain("vidoc-remote");
  expect(normalizeNofluff(kept[1]).externalId).toBe("DXYXVVP5");
});

test("justjoin and himalayas fetch URLs use filter values", () => {
  const jj = justjoinOffersUrl(0, "React", "senior");
  expect(jj).toContain("skills=React");
  expect(jj).toContain("experienceLevels=senior");
  expect(jj).toContain("itemsCount=100");
  const him = himalayasSearchUrl({
    values: { q: ["react"], seniority: ["Senior"] },
    exclude: [],
  });
  expect(him).toContain("q=react");
  expect(him).toContain("seniority=Senior");
});

test("justjoin matchFields exposes workplace and skills", () => {
  const raw = JSON.parse(fx("justjoin-one.json"));
  const job = normalizeJustjoin(raw);
  expect(matchJustjoin(raw, job)).toEqual({
    skills: ["React", "TypeScript"],
    experienceLevels: ["senior"],
    workplaceType: ["remote"],
    employmentTypes: ["b2b"],
  });
});

test("himalayas matchFields uses skill-filtered categories", () => {
  const raw = JSON.parse(fx("himalayas-one.json"));
  const job = normalizeHimalayas(raw);
  expect(matchHimalayas(raw, job).categories).toEqual(["React", "TypeScript"]);
});
