import { getSupabaseAdmin } from "@/lib/supabase/admin";

type PhaseSource = "checkout" | "transbank" | "mercadopago" | "mock" | "operations" | "system";

export async function trackBookingPhase(input: {
  bookingId: string;
  paymentId?: string | null;
  phase: string;
  source?: PhaseSource;
  payload?: Record<string, unknown> | null;
}) {
  const supabase = getSupabaseAdmin();
  const source = input.source ?? "system";
  const row = {
    booking_id: input.bookingId,
    payment_id: input.paymentId ?? null,
    phase: input.phase,
    source,
    payload_json: input.payload ?? null,
  };
  const insert = await supabase.from("booking_phase_events").insert(row);

  if (!insert.error) {
    return;
  }

  const missingTable =
    insert.error.code === "PGRST205" ||
    insert.error.message.includes("booking_phase_events") ||
    insert.error.message.includes("schema cache");

  if (missingTable) {
    const fallback = await supabase.from("webhooks_log").insert({
      provider: `booking_phase:${source}`,
      payload_json: {
        booking_id: input.bookingId,
        payment_id: input.paymentId ?? null,
        phase: input.phase,
        source,
        payload: input.payload ?? null,
      },
      processed: true,
    });

    if (!fallback.error) {
      return;
    }
  }

  throw new Error(`booking_phase_track_failed:${input.phase}`);
}
