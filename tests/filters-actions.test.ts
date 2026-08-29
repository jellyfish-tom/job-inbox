import { expect, test } from "vitest";
import { sanitizeTrackFilter } from "@/lib/filter-defaults";
import type { TrackFilter } from "@/types/job";

test("save path sanitizes: empty group removed, blanks trimmed", () => {
  const input: TrackFilter = {
    requiredGroups: [
      { label: "Stack", keywords: ["React", " ", ""] },
      { label: "Blank", keywords: [""] },
    ],
    exclude: [" hybrid ", ""],
  };
  expect(sanitizeTrackFilter(input)).toEqual({
    requiredGroups: [{ label: "Stack", keywords: ["React"] }],
    exclude: ["hybrid"],
  });
});

test("removing all groups yields accept-all config", () => {
  const input: TrackFilter = { requiredGroups: [], exclude: [] };
  expect(sanitizeTrackFilter(input)).toEqual({ requiredGroups: [], exclude: [] });
});
