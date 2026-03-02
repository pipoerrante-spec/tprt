import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDemoSlots, ensureDemoCoverageAndRules } from "@/lib/demo/availability";
import { applyTemporaryAvailabilityWindow } from "@/lib/availability-window";
import { getAgendaReleaseStateMap } from "@/lib/ops-agenda";
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
  const releaseStateMap = await getAgendaReleaseStateMap(
    Array.from({ length: 32 }).map((_, index) => {
      const base = new Date(`${parsed.data.dateFrom}T12:00:00Z`);
      base.setUTCDate(base.getUTCDate() + index);
      return base.toISOString().slice(0, 10);
    }).filter((date) => date >= parsed.data.dateFrom && date <= parsed.data.dateTo),
  );
  const releaseMap = new Map(
    [...releaseStateMap.entries()].map(([date, state]) => [date, state.releasedUntilTime]),
  );

  const { data, error } = await supabase.rpc("get_availability_slots", payload);

  if (!error && (data?.length ?? 0) > 0) {
    return NextResponse.json(
      { slots: applyTemporaryAvailabilityWindow(data, releaseMap) },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  await ensureDemoCoverageAndRules(supabase, parsed.data.serviceId, parsed.data.communeId).catch(() => undefined);

  const retry = await supabase.rpc("get_availability_slots", payload);
  if (!retry.error && (retry.data?.length ?? 0) > 0) {
    return NextResponse.json(
      { slots: applyTemporaryAvailabilityWindow(retry.data, releaseMap) },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { slots: applyTemporaryAvailabilityWindow(buildDemoSlots(parsed.data.dateFrom, parsed.data.dateTo), releaseMap) },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
