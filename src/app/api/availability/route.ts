import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const querySchema = z.object({
  serviceId: z.string().uuid(),
  communeId: z.string().uuid(),
  dateFrom: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  dateTo: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
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
  const { data, error } = await supabase.rpc("get_availability_slots", {
    p_service_id: parsed.data.serviceId,
    p_commune_id: parsed.data.communeId,
    p_date_from: parsed.data.dateFrom,
    p_date_to: parsed.data.dateTo,
  });

  if (error) {
    return NextResponse.json({ error: "availability_unavailable" }, { status: 500 });
  }

  return NextResponse.json({ slots: data }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

