import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, expect, test } from "vitest";
import { getDb, resetDbClient } from "@/lib/db/client";
import { DEFAULT_SOURCE_FILTERS } from "@/lib/filter-defaults";
import {
  getAllSourceFilters,
  getSourceFilter,
  resetSourceFilter,
  saveSourceFilter,
} from "@/lib/db/queries";
import type { SourceFilter } from "@/types/job";

process.env.TURSO_DATABASE_URL = "file:tests/tmp-filter-config.test.db";

const dbPath = path.join(process.cwd(), "tests/tmp-filter-config.test.db");
const migrationsDir = path.join(process.cwd(), "db/migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

beforeEach(async () => {
  resetDbClient();
  if (existsSync(dbPath)) unlinkSync(dbPath);
  for (const file of migrationFiles) {
    await getDb().executeMultiple(
      readFileSync(path.join(migrationsDir, file), "utf8"),
    );
  }
});

afterAll(() => {
  resetDbClient();
  if (existsSync(dbPath)) unlinkSync(dbPath);
});

test("missing row falls back to defaults", async () => {
  expect(await getSourceFilter("justjoin")).toEqual(
    DEFAULT_SOURCE_FILTERS.justjoin,
  );
  expect(await getAllSourceFilters()).toEqual(DEFAULT_SOURCE_FILTERS);
});

test("save round-trips and reset restores defaults", async () => {
  const custom: SourceFilter = {
    values: { skills: ["Vue"] },
    exclude: ["intern"],
  };
  await saveSourceFilter("justjoin", custom);
  expect(await getSourceFilter("justjoin")).toEqual(custom);

  await resetSourceFilter("justjoin");
  expect(await getSourceFilter("justjoin")).toEqual(
    DEFAULT_SOURCE_FILTERS.justjoin,
  );
});

test("malformed row falls back to defaults", async () => {
  await getDb().execute({
    sql: `INSERT INTO source_filter_config (source, config, updated_at) VALUES (?, ?, ?)`,
    args: ["justjoin", "{not json", new Date().toISOString()],
  });
  expect(await getSourceFilter("justjoin")).toEqual(
    DEFAULT_SOURCE_FILTERS.justjoin,
  );
});

test("valid JSON but wrong shape falls back to defaults", async () => {
  await getDb().execute({
    sql: `INSERT INTO source_filter_config (source, config, updated_at) VALUES (?, ?, ?)`,
    args: [
      "himalayas",
      JSON.stringify({ values: "nope", exclude: [] }),
      new Date().toISOString(),
    ],
  });
  expect(await getSourceFilter("himalayas")).toEqual(
    DEFAULT_SOURCE_FILTERS.himalayas,
  );
});

test("leftover filter_config rows are ignored", async () => {
  await getDb().execute({
    sql: `INSERT INTO filter_config (track, config, updated_at) VALUES (?, ?, ?)`,
    args: [
      "A",
      JSON.stringify({ requiredGroups: [], exclude: ["intern"] }),
      new Date().toISOString(),
    ],
  });
  expect(await getSourceFilter("himalayas")).toEqual(
    DEFAULT_SOURCE_FILTERS.himalayas,
  );
});
