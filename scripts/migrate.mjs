import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const sql = readFileSync(
  path.join(__dirname, "../db/migrations/001_init.sql"),
  "utf8",
);

const db = createClient({ url, authToken });
await db.executeMultiple(sql);
console.log(`Migrated ${url}`);
