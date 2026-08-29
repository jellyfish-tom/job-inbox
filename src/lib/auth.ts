import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "inbox_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret ? secret : null;
}

function sessionHmac(expMs: string, secret: string): string {
  return createHmac("sha256", secret).update(expMs).digest("hex");
}

export function signSession(nowMs: number = Date.now()): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  const expMs = (nowMs + SESSION_TTL_MS).toString();
  return `${expMs}.${sessionHmac(expMs, secret)}`;
}

export function verifySession(
  token: string,
  nowMs: number = Date.now(),
): boolean {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;

  const expMsStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const secret = sessionSecret();
  if (!secret) return false;

  const expMs = Number(expMsStr);
  if (!Number.isFinite(expMs) || expMs <= nowMs) return false;

  const expected = sessionHmac(expMsStr, secret);
  if (sig.length !== expected.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

export function passwordOk(password: string): boolean {
  return password === process.env.APP_PASSWORD;
}
