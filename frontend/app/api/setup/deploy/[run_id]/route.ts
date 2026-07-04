import { NextRequest } from "next/server";
import { proxy } from "@/lib/setupProxy";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest, ctx: { params: { run_id: string } }) {
  return proxy(req, `/deploy/${encodeURIComponent(ctx.params.run_id)}`);
}
