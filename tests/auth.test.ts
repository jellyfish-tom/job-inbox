import { createHmac } from "node:crypto";
import { expect, test } from "vitest";
import { passwordOk, signSession, verifySession } from "@/lib/auth";

process.env.SESSION_SECRET = "test-secret";
process.env.APP_PASSWORD = "secret";

test("sign/verify roundtrip", async () => {
  const t = await signSession(1_700_000_000_000);
  expect(await verifySession(t, 1_700_000_000_000)).toBe(true);
});

test("expired token fails", async () => {
  const t = await signSession(1_000);
  expect(await verifySession(t, 1_000 + 31 * 24 * 60 * 60 * 1000)).toBe(false);
});

test("tampered token fails", async () => {
  const t = await signSession(1_700_000_000_000);
  expect(await verifySession(t.slice(0, -2) + "ff", 1_700_000_000_000)).toBe(false);
});

test("passwordOk", () => {
  expect(passwordOk("secret")).toBe(true);
  expect(passwordOk("nope")).toBe(false);
});

test("token HMAC matches independent node:crypto reference", async () => {
  const nowMs = 1_700_000_000_000;
  const token = await signSession(nowMs);
  const expMs = String(nowMs + 30 * 24 * 60 * 60 * 1000);
  const expected = createHmac("sha256", "test-secret").update(expMs).digest("hex");
  expect(token).toBe(`${expMs}.${expected}`);
});
