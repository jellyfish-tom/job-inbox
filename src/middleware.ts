import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "inbox_session";
const PUBLIC_PATHS = ["/login", "/api/refresh"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifySessionEdge(
  token: string,
  secret: string,
  nowMs: number,
): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;

  const expMsStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expMs = Number(expMsStr);
  if (!Number.isFinite(expMs) || expMs <= nowMs) return false;

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
    new TextEncoder().encode(expMsStr),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return hexEqual(sig, expected);
}

export async function middleware(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  const token = req.cookies.get(COOKIE)?.value;
  if (
    secret &&
    token &&
    (await verifySessionEdge(token, secret, Date.now()))
  ) {
    return NextResponse.next();
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
