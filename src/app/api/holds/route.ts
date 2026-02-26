import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDemoCoverageAndRules } from "@/lib/demo/availability";
import { getEnv } from "@/lib/env";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const createHoldSchema = z.object({
  serviceId: z.string().uuid(),
  communeId: z.string().uuid(),
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
  time: z.string().regex(/^\\d{2}:\\d{2}$/),
});

function mapHoldError(message?: string) {
  const m = message || "";
  if (m.includes("tprt_slot_full")) return { code: "slot_full", status: 409 as const };
  if (m.includes("tprt_slot_not_available")) return { code: "slot_not_available", status: 409 as const };
  if (m.includes("tprt_not_in_coverage")) return { code: "not_in_coverage", status: 400 as const };
  return { code: "hold_failed", status: 500 as const };
}

function shouldRetryWithDemoRules(message?: string) {
  const m = message || "";
  return !m || m.includes("tprt_slot_not_available") || m.includes("tprt_not_in_coverage");
}

export async function POST(req: Request) {
  const ip = getRequestIp(new Headers(req.headers));
  const limit = rateLimit(`hold:${ip}`, { windowMs: 10 * 60_000, max: 12 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: limit.resetAt },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = createHoldSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const env = getEnv();
  const supabase = getSupabaseAdmin();
  const payload = {
    p_service_id: parsed.data.serviceId,
    p_commune_id: parsed.data.communeId,
    p_date: parsed.data.date,
    p_time: parsed.data.time,
    p_ttl_minutes: env.TPRT_HOLD_TTL_MINUTES,
  };

  let { data, error } = await supabase.rpc("create_booking_hold", payload);

  if ((error || !data?.[0]) && shouldRetryWithDemoRules(error?.message)) {
    await ensureDemoCoverageAndRules(supabase, parsed.data.serviceId, parsed.data.communeId).catch(() => undefined);
    const retry = await supabase.rpc("create_booking_hold", payload);
    data = retry.data;
    error = retry.error;
  }

  if (error || !data?.[0]) {
    const mapped = mapHoldError(error?.message);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }

  return NextResponse.json(
    { holdId: data[0].hold_id, expiresAt: data[0].expires_at },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
