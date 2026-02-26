import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDemoCoverageAndRulesForCommunes } from "@/lib/demo/availability";
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

  const needsFallback = Boolean(error) || !data?.length;
  if (!needsFallback) {
    return NextResponse.json({ communes: data }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const fallbackCommunes = await supabase
    .from("communes")
    .select("id,name,region")
    .eq("active", true)
    .order("region", { ascending: true })
    .order("name", { ascending: true });

  if (fallbackCommunes.error) {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 500 });
  }

  const communeIds = (fallbackCommunes.data ?? []).map((c) => c.id);
  if (communeIds.length > 0) {
    await ensureDemoCoverageAndRulesForCommunes(supabase, parsed.data.serviceId, communeIds).catch(() => undefined);
  }

  return NextResponse.json({ communes: fallbackCommunes.data ?? [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
