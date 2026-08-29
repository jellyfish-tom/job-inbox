import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/refresh"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(req: NextRequest) {
  if (isPublicPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (token && (await verifySession(token))) {
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
