import { NextRequest } from "next/server";
import { proxy } from "@/lib/setupProxy";

export const dynamic = "force-dynamic";

export function PUT(req: NextRequest, ctx: { params: { agent_id: string } }) {
  return proxy(req, `/agents/${encodeURIComponent(ctx.params.agent_id)}`);
}

export function DELETE(req: NextRequest, ctx: { params: { agent_id: string } }) {
  return proxy(req, `/agents/${encodeURIComponent(ctx.params.agent_id)}`);
}
