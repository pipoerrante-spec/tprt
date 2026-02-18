import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const querySchema = z.object({
  serviceId: z.string().uuid(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ serviceId: url.searchParams.get("serviceId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_communes_for_service", {
    p_service_id: parsed.data.serviceId,
  });

  if (error) {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 500 });
  }
  return NextResponse.json({ communes: data }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

