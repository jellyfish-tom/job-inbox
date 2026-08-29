import { LibsqlError } from "@libsql/client";
import { afterEach, expect, test, vi } from "vitest";
import { authorizeRefresh, parseSourceParam } from "@/lib/refresh-http";

vi.mock("@/lib/refresh", () => ({
  refreshSource: vi.fn(),
}));

import { POST } from "@/app/api/refresh/route";
import { refreshSource } from "@/lib/refresh";

const sources = [
  "jungle",
  "himalayas",
  "wwr",
  "justjoin",
  "nofluff",
  "remoteok",
] as const;

const refreshSecret = "test-secret";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.REFRESH_SECRET;
});

test("authorizeRefresh accepts matching bearer", () => {
  expect(authorizeRefresh("Bearer test-secret", "test-secret")).toBe(true);
});

test("authorizeRefresh rejects missing or wrong bearer", () => {
  expect(authorizeRefresh(null, "test-secret")).toBe(false);
  expect(authorizeRefresh("Bearer wrong", "test-secret")).toBe(false);
  expect(authorizeRefresh("test-secret", "test-secret")).toBe(false);
});

test("parseSourceParam accepts all six sources", () => {
  for (const source of sources) {
    expect(parseSourceParam(source)).toBe(source);
  }
});

test("parseSourceParam rejects unknown or missing source", () => {
  expect(parseSourceParam(null)).toBe(null);
  expect(parseSourceParam("")).toBe(null);
  expect(parseSourceParam("linkedin")).toBe(null);
});

test("POST returns 503 with db error when refreshSource throws LibsqlError", async () => {
  process.env.REFRESH_SECRET = refreshSecret;
  vi.mocked(refreshSource).mockRejectedValue(
    new LibsqlError("db unavailable", "UNAVAILABLE", 0),
  );

  const response = await POST(
    new Request("http://localhost/api/refresh?source=remoteok", {
      method: "POST",
      headers: { authorization: `Bearer ${refreshSecret}` },
    }),
  );

  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "db" });
});
