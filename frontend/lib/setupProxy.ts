// Generic proxy for /api/setup/* → FastAPI backend.
//
// If API_URL is not set (demo/preview deploy on Vercel with no backend), we
// return a friendly `{ demo: true }` response instead of a 500. The wizard
// treats that as read-only mode and shows a banner.

import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL || "";

export async function proxy(req: NextRequest, path: string) {
  if (!API_URL) {
    return NextResponse.json(
      {
        demo: true,
        detail:
          "Setup engine needs the FastAPI backend to run. Set API_URL in the Next.js environment to point at it.",
      },
      { status: 503 },
    );
  }
  const method = req.method;
  const url = `${API_URL}/setup${path}`;
  const init: RequestInit = { method, cache: "no-store" };
  if (method !== "GET" && method !== "HEAD") {
    const body = await req.text();
    init.body = body || undefined;
    init.headers = { "content-type": "application/json" };
  }
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    return NextResponse.json(
      { detail: `Cannot reach backend at ${API_URL}: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}
