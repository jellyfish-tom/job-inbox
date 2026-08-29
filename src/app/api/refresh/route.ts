import { NextResponse } from "next/server";
import { LibsqlError } from "@libsql/client";
import { authorizeRefresh, parseSourceParam } from "@/lib/refresh-http";
import { refreshSource } from "@/lib/refresh";

export async function POST(request: Request) {
  const secret = process.env.REFRESH_SECRET;
  if (!secret || !authorizeRefresh(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const source = parseSourceParam(url.searchParams.get("source"));
  if (!source) {
    return NextResponse.json({ error: "unknown source" }, { status: 400 });
  }

  try {
    const result = await refreshSource(source);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LibsqlError) {
      return NextResponse.json({ error: "db" }, { status: 503 });
    }
    return new NextResponse(null, { status: 500 });
  }
}
