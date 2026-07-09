import { NextRequest, NextResponse } from "next/server";
import { doctor } from "@/src/openclaw/cli";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const fix = url.searchParams.get("fix") === "true";
  try {
    const r = await doctor(fix);
    return NextResponse.json({
      ok: r.code === 0,
      output: (r.stdout || r.stderr).trim(),
      exit: r.code,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
