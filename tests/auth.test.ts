import { expect, test } from "vitest";
import { passwordOk, signSession, verifySession } from "@/lib/auth";

process.env.SESSION_SECRET = "test-secret";
process.env.APP_PASSWORD = "secret";

test("sign/verify roundtrip", () => {
  const t = signSession(1_700_000_000_000);
  expect(verifySession(t, 1_700_000_000_000)).toBe(true);
});

test("expired token fails", () => {
  const t = signSession(1_000);
  expect(verifySession(t, 1_000 + 31 * 24 * 60 * 60 * 1000)).toBe(false);
});

test("tampered token fails", () => {
  const t = signSession(1_700_000_000_000);
  expect(verifySession(t.slice(0, -2) + "ff", 1_700_000_000_000)).toBe(false);
});

test("passwordOk", () => {
  expect(passwordOk("secret")).toBe(true);
  expect(passwordOk("nope")).toBe(false);
});
