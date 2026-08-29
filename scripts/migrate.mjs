import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const dir = path.join(__dirname, "../db/migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const db = createClient({ url, authToken });
for (const file of files) {
  const sql = readFileSync(path.join(dir, file), "utf8");
  await db.executeMultiple(sql);
  console.log(`Applied ${file}`);
}
console.log(`Migrated ${url}`);
