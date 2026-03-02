import { NextResponse } from "next/server";
import { z } from "zod";
import { trackBookingPhase } from "@/lib/bookings/phases";
import { isWithinTemporarySingleOperatorWindow } from "@/lib/availability-window";
import { releaseNextAgendaSlot } from "@/lib/ops-agenda";
import { assertOpsAuthorized, OPS_USERNAME } from "@/lib/ops-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const authError = await assertOpsAuthorized();
  if (authError) return authError;

  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const bookingResult = await supabase
    .from("bookings")
    .select("id,status,date,time")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (bookingResult.error) {
    return NextResponse.json({ error: "booking_unavailable" }, { status: 500 });
  }
  if (!bookingResult.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const booking = bookingResult.data;
  const wasAlreadyCompleted = booking.status === "completed";
  const update = wasAlreadyCompleted
    ? { error: null }
    : await supabase.from("bookings").update({ status: "completed" }).eq("id", booking.id).eq("status", "confirmed");

  if (update.error) {
    return NextResponse.json({ error: "booking_update_failed" }, { status: 500 });
  }

  let release = { releasedUntilTime: booking.time.slice(0, 5), nextTime: null as string | null };
  if (!wasAlreadyCompleted && isWithinTemporarySingleOperatorWindow(booking.date)) {
    try {
      release = await releaseNextAgendaSlot({
        bookingId: booking.id,
        date: booking.date,
        time: booking.time,
        releasedBy: OPS_USERNAME,
      });
    } catch {
      return NextResponse.json({ error: "agenda_release_failed" }, { status: 500 });
    }
  }

  if (!wasAlreadyCompleted) {
    await trackBookingPhase({
      bookingId: booking.id,
      phase: "service_completed",
      source: "operations",
      payload: {
        releasedUntilTime: release.releasedUntilTime,
        nextTime: release.nextTime,
        releasedBy: OPS_USERNAME,
      },
    }).catch(() => undefined);
  }

  return NextResponse.json(
    {
      ok: true,
      bookingId: booking.id,
      releasedUntilTime: release.releasedUntilTime,
      nextTime: release.nextTime,
    },
    { status: 200 },
  );
}
