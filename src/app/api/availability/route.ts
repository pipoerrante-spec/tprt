import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDemoSlots, ensureDemoCoverageAndRules } from "@/lib/demo/availability";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const querySchema = z.object({
  serviceId: z.string().uuid(),
  communeId: z.string().uuid(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    serviceId: url.searchParams.get("serviceId"),
    communeId: url.searchParams.get("communeId"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const payload = {
    p_service_id: parsed.data.serviceId,
    p_commune_id: parsed.data.communeId,
    p_date_from: parsed.data.dateFrom,
    p_date_to: parsed.data.dateTo,
  };

  const { data, error } = await supabase.rpc("get_availability_slots", payload);

  if (!error && (data?.length ?? 0) > 0) {
    return NextResponse.json({ slots: data }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  await ensureDemoCoverageAndRules(supabase, parsed.data.serviceId, parsed.data.communeId).catch(() => undefined);

  const retry = await supabase.rpc("get_availability_slots", payload);
  if (!retry.error && (retry.data?.length ?? 0) > 0) {
    return NextResponse.json({ slots: retry.data }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { slots: buildDemoSlots(parsed.data.dateFrom, parsed.data.dateTo) },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
