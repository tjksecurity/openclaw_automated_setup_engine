import { NextRequest } from "next/server";
import { proxy } from "@/lib/setupProxy";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return proxy(req, "/catalog");
}
