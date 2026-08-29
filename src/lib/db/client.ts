import { createClient } from "@libsql/client";

let client: ReturnType<typeof createClient> | null = null;

export function getDb(): ReturnType<typeof createClient> {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return client;
}

export function resetDbClient(): void {
  client = null;
}
