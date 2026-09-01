import { expect, test } from "vitest";
import { sanitizeSourceFilter } from "@/lib/filter-defaults";

test("save path sanitizes: unknown ids dropped, blanks trimmed", () => {
  expect(
    sanitizeSourceFilter(
      {
        values: {
          skills: ["React", " ", ""],
          nope: ["x"],
        },
        exclude: [" hybrid ", ""],
      },
      ["skills"],
    ),
  ).toEqual({
    values: { skills: ["React"] },
    exclude: ["hybrid"],
  });
});

test("empty values yield accept-all field constraints", () => {
  expect(
    sanitizeSourceFilter({ values: {}, exclude: [] }, ["skills"]),
  ).toEqual({ values: {}, exclude: [] });
});
