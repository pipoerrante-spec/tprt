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

  const fallbackCommunes = await supabase
    .from("communes")
    .select("id,name,region")
    .eq("active", true)
    .order("region", { ascending: true })
    .order("name", { ascending: true });

  if (fallbackCommunes.error) {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 500 });
  }

  const activeCommunes: Array<{ id: string; name: string; region: string }> = fallbackCommunes.data ?? [];
  const activeCommuneIds = activeCommunes.map((c) => c.id);
  const visibleCommunes: Array<{ id: string; name: string; region: string }> = data ?? [];
  const visibleIds = new Set(visibleCommunes.map((c) => c.id));
  const missingCommuneIds = activeCommuneIds.filter((id) => !visibleIds.has(id));
  const needsFallback = Boolean(error) || !visibleCommunes.length;

  if (!needsFallback && missingCommuneIds.length === 0) {
    return NextResponse.json({ communes: visibleCommunes }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  if (activeCommuneIds.length > 0) {
    await ensureDemoCoverageAndRulesForCommunes(supabase, parsed.data.serviceId, activeCommuneIds).catch(() => undefined);
  }

  return NextResponse.json({ communes: activeCommunes }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
