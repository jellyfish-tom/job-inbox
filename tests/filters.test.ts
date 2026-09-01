import { expect, test } from "vitest";
import { sanitizeSourceFilter } from "@/lib/filter-defaults";
import { matchesSource, toMatchInput } from "@/lib/filters";
import type { SourceCapabilities, SourceFilter } from "@/types/job";

const caps: SourceCapabilities = {
  source: "justjoin",
  fields: [
    {
      id: "skills",
      label: "Skills",
      kind: "both",
      valueType: "tokens",
      queryKey: "skills",
    },
    {
      id: "experienceLevels",
      label: "Experience",
      kind: "fetch",
      valueType: "enum",
      queryKey: "experienceLevels",
    },
    {
      id: "workplaceType",
      label: "Workplace",
      kind: "match",
      valueType: "enum",
    },
  ],
};

function input(
  fields: Record<string, string[]>,
  extra: Partial<{ title: string; description: string; tags: string[] }> = {},
) {
  return toMatchInput(
    extra.title ?? "Senior React Developer",
    extra.description ?? "",
    extra.tags ?? ["React"],
    fields,
  );
}

test("OR in field and AND across present fields", () => {
  const filter: SourceFilter = {
    values: { skills: ["React", "TypeScript"], workplaceType: ["remote"] },
    exclude: [],
  };
  expect(
    matchesSource(
      input({ skills: ["TypeScript"], workplaceType: ["remote"] }),
      filter,
      caps,
    ),
  ).toBe(true);
  expect(
    matchesSource(
      input({ skills: ["Java"], workplaceType: ["remote"] }),
      filter,
      caps,
    ),
  ).toBe(false);
  expect(
    matchesSource(
      input({ skills: ["React"], workplaceType: ["office"] }),
      filter,
      caps,
    ),
  ).toBe(false);
});

test("missing and any pass a required field", () => {
  const filter: SourceFilter = {
    values: { workplaceType: ["remote"], skills: ["React"] },
    exclude: [],
  };
  expect(
    matchesSource(input({ skills: ["React"], workplaceType: [] }), filter, caps),
  ).toBe(true);
  expect(
    matchesSource(
      input({ skills: ["React"], workplaceType: ["any"] }),
      filter,
      caps,
    ),
  ).toBe(true);
});

test("empty values skip the field; fetch-only fields are not matched", () => {
  const filter: SourceFilter = {
    values: { workplaceType: [], experienceLevels: ["senior"] },
    exclude: [],
  };
  expect(
    matchesSource(
      input({ skills: ["Java"], workplaceType: ["office"] }),
      filter,
      caps,
    ),
  ).toBe(true);
});

test("exclude hits title, description, and tags only", () => {
  const filter: SourceFilter = {
    values: {},
    exclude: ["hybrid"],
  };
  expect(
    matchesSource(input({}, { description: "hybrid 3 days" }), filter, caps),
  ).toBe(false);
  expect(
    matchesSource(input({}, { title: "Hybrid Lead" }), filter, caps),
  ).toBe(false);
  expect(
    matchesSource(input({}, { tags: ["hybrid"] }), filter, caps),
  ).toBe(false);
  expect(
    matchesSource(
      input({ workplaceType: ["hybrid"] }, { description: "fully remote" }),
      filter,
      caps,
    ),
  ).toBe(true);
});

test("sanitizeSourceFilter drops unknown ids, blanks, and duplicate case", () => {
  expect(
    sanitizeSourceFilter(
      {
        values: {
          skills: [" React ", "react", ""],
          nope: ["x"],
        },
        exclude: ["hybrid", "", " Hybrid "],
      },
      ["skills", "workplaceType"],
    ),
  ).toEqual({
    values: { skills: ["React"] },
    exclude: ["hybrid"],
  });
});
