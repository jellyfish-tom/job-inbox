import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, expect, test } from "vitest";
import { getDb, resetDbClient } from "@/lib/db/client";
import { DEFAULT_FILTERS } from "@/lib/filter-defaults";
import {
  getAllFilterConfigs,
  getFilterConfig,
  resetFilterConfig,
  saveFilterConfig,
} from "@/lib/db/queries";
import type { TrackFilter } from "@/types/job";

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
  expect(await getFilterConfig("A")).toEqual(DEFAULT_FILTERS.A);
  expect(await getAllFilterConfigs()).toEqual(DEFAULT_FILTERS);
});

test("save round-trips and reset restores defaults", async () => {
  const custom: TrackFilter = {
    requiredGroups: [{ label: "Stack", keywords: ["vue"] }],
    exclude: ["intern"],
  };
  await saveFilterConfig("A", custom);
  expect(await getFilterConfig("A")).toEqual(custom);

  await resetFilterConfig("A");
  expect(await getFilterConfig("A")).toEqual(DEFAULT_FILTERS.A);
});

test("malformed row falls back to defaults", async () => {
  await getDb().execute({
    sql: `INSERT INTO filter_config (track, config, updated_at) VALUES (?, ?, ?)`,
    args: ["B", "{not json", new Date().toISOString()],
  });
  expect(await getFilterConfig("B")).toEqual(DEFAULT_FILTERS.B);
});
