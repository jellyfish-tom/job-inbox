import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const dir = `${import.meta.dir}/../db/migrations`;
const files = [...new Bun.Glob("*.sql").scanSync(dir)].sort();

const db = createClient({ url, authToken });
for (const file of files) {
  const sql = await Bun.file(`${dir}/${file}`).text();
  await db.executeMultiple(sql);
  console.log(`Applied ${file}`);
}
console.log(`Migrated ${url}`);
