import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedAgendaTime, isWithinTemporarySingleOperatorWindow, TEMP_SINGLE_OPERATOR_CAPACITY } from "@/lib/availability-window";
import { ensureDemoCoverageAndRules } from "@/lib/demo/availability";
import { getEnv } from "@/lib/env";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const createHoldSchema = z.object({
  serviceId: z.string().uuid(),
  communeId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
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
  return (
    !m ||
    m.includes("tprt_slot_not_available") ||
    m.includes("tprt_not_in_coverage") ||
    m.includes("function public.create_booking_hold") ||
    m.includes("undefined_function")
  );
}

function shouldUseQaDirectInsert(message?: string) {
  const m = message || "";
  if (!m) return false;
  if (m.includes("tprt_slot_full") || m.includes("tprt_slot_not_available") || m.includes("tprt_not_in_coverage")) {
    return false;
  }
  return (
    m.includes("function public.create_booking_hold") ||
    m.includes("undefined_function") ||
    m.includes("does not exist") ||
    m.includes("No function matches")
  );
}

async function countTemporaryWindowReservations(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  input: { serviceId: string; communeId: string; date: string; time: string; excludeHoldId?: string },
) {
  const [bookings, holds] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("service_id", input.serviceId)
      .eq("commune_id", input.communeId)
      .eq("date", input.date)
      .eq("time", input.time)
      .in("status", ["pending_payment", "confirmed"]),
    supabase
      .from("booking_holds")
      .select("id", { count: "exact", head: true })
      .eq("service_id", input.serviceId)
      .eq("commune_id", input.communeId)
      .eq("date", input.date)
      .eq("time", input.time)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .neq("id", input.excludeHoldId ?? "00000000-0000-0000-0000-000000000000"),
  ]);

  if (bookings.error || holds.error) {
    return { total: null as number | null, error: bookings.error ?? holds.error };
  }

  return { total: (bookings.count ?? 0) + (holds.count ?? 0), error: null };
}

export async function POST(req: Request) {
  const ip = getRequestIp(new Headers(req.headers));
  const limit = rateLimit(`hold:${ip}`, { windowMs: 10 * 60_000, max: 40 });
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
  const normalizedTime = parsed.data.time.length === 5 ? `${parsed.data.time}:00` : parsed.data.time;

  if (isWithinTemporarySingleOperatorWindow(parsed.data.date) && !isAllowedAgendaTime(parsed.data.date, normalizedTime)) {
    return NextResponse.json({ error: "slot_not_available" }, { status: 409 });
  }

  if (isWithinTemporarySingleOperatorWindow(parsed.data.date)) {
    const current = await countTemporaryWindowReservations(supabase, {
      serviceId: parsed.data.serviceId,
      communeId: parsed.data.communeId,
      date: parsed.data.date,
      time: normalizedTime,
    });
    if (current.error) {
      return NextResponse.json({ error: "hold_failed" }, { status: 500 });
    }
    if ((current.total ?? 0) >= TEMP_SINGLE_OPERATOR_CAPACITY) {
      return NextResponse.json({ error: "slot_full" }, { status: 409 });
    }
  }

  const payload = {
    p_service_id: parsed.data.serviceId,
    p_commune_id: parsed.data.communeId,
    p_date: parsed.data.date,
    p_time: normalizedTime,
    p_ttl_minutes: env.TPRT_HOLD_TTL_MINUTES,
  };

  let { data, error } = await supabase.rpc("create_booking_hold", payload);

  if ((error || !data?.[0]) && shouldRetryWithDemoRules(error?.message)) {
    await ensureDemoCoverageAndRules(supabase, parsed.data.serviceId, parsed.data.communeId).catch(() => undefined);
    const retry = await supabase.rpc("create_booking_hold", payload);
    data = retry.data;
    error = retry.error;
  }

  // QA safety net: if RPC fails for any migration/signature reason, insert hold directly.
  if ((error || !data?.[0]) && env.TRANSBANK_ENV === "qa" && shouldUseQaDirectInsert(error?.message)) {
    const expiresAt = new Date(Date.now() + env.TPRT_HOLD_TTL_MINUTES * 60_000).toISOString();
    const direct = await supabase
      .from("booking_holds")
      .insert({
        service_id: parsed.data.serviceId,
        commune_id: parsed.data.communeId,
        date: parsed.data.date,
        time: normalizedTime,
        expires_at: expiresAt,
        status: "active",
      })
      .select("id,expires_at")
      .single();

    if (!direct.error && direct.data) {
      if (isWithinTemporarySingleOperatorWindow(parsed.data.date)) {
        const current = await countTemporaryWindowReservations(supabase, {
          serviceId: parsed.data.serviceId,
          communeId: parsed.data.communeId,
          date: parsed.data.date,
          time: normalizedTime,
          excludeHoldId: direct.data.id,
        });
        if (current.error) {
          return NextResponse.json({ error: "hold_failed" }, { status: 500 });
        }
        if ((current.total ?? 0) >= TEMP_SINGLE_OPERATOR_CAPACITY) {
          await supabase.from("booking_holds").update({ status: "canceled" }).eq("id", direct.data.id);
          return NextResponse.json({ error: "slot_full" }, { status: 409 });
        }
      }

      return NextResponse.json(
        { holdId: direct.data.id, expiresAt: direct.data.expires_at },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }

    error = direct.error ?? error;
  }

  if (error || !data?.[0]) {
    const mapped = mapHoldError(error?.message);
    return NextResponse.json({ error: mapped.code }, { status: mapped.status });
  }

  if (isWithinTemporarySingleOperatorWindow(parsed.data.date)) {
    const current = await countTemporaryWindowReservations(supabase, {
      serviceId: parsed.data.serviceId,
      communeId: parsed.data.communeId,
      date: parsed.data.date,
      time: normalizedTime,
      excludeHoldId: data[0].hold_id,
    });
    if (current.error) {
      return NextResponse.json({ error: "hold_failed" }, { status: 500 });
    }
    if ((current.total ?? 0) >= TEMP_SINGLE_OPERATOR_CAPACITY) {
      await supabase.from("booking_holds").update({ status: "canceled" }).eq("id", data[0].hold_id);
      return NextResponse.json({ error: "slot_full" }, { status: 409 });
    }
  }

  return NextResponse.json(
    { holdId: data[0].hold_id, expiresAt: data[0].expires_at },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
