export const COOKIE = "inbox_session";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret ? secret : null;
}

async function sessionHmac(expMs: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(expMs),
  );
  return Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signSession(nowMs: number = Date.now()): Promise<string> {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  const expMs = (nowMs + SESSION_TTL_MS).toString();
  return `${expMs}.${await sessionHmac(expMs, secret)}`;
}

export async function verifySession(
  token: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;

  const expMsStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const secret = sessionSecret();
  if (!secret) return false;

  const expMs = Number(expMsStr);
  if (!Number.isFinite(expMs) || expMs <= nowMs) return false;

  return hexEqual(sig, await sessionHmac(expMsStr, secret));
}

export function passwordOk(password: string): boolean {
  return password === process.env.APP_PASSWORD;
}
