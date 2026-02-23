import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function appendBookingToPlanilla(bookingId: string) {
  const env = getEnv();
  if (!env.TPRT_PLANILLA_WEBHOOK_URL) throw new Error("planilla_not_configured");

  const supabase = getSupabaseAdmin();

  const booking = await supabase
    .from("bookings")
    .select(
      "id,status,date,time,customer_name,email,phone,address,notes,vehicle_plate,vehicle_make,vehicle_model,vehicle_year,service_id,commune_id,created_at",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (booking.error || !booking.data) throw new Error("booking_not_found");

  const service = await supabase
    .from("services")
    .select("name,base_price")
    .eq("id", booking.data.service_id)
    .maybeSingle();

  const commune = await supabase
    .from("communes")
    .select("name,region")
    .eq("id", booking.data.commune_id)
    .maybeSingle();

  const payment = await supabase
    .from("payments")
    .select("status,provider,amount_clp,currency,created_at,external_ref")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    booking: booking.data,
    service: service.data ?? null,
    commune: commune.data ?? null,
    payment: payment.data ?? null,
  };

  const res = await fetch(env.TPRT_PLANILLA_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.TPRT_PLANILLA_WEBHOOK_SECRET ? { "x-tprt-planilla-secret": env.TPRT_PLANILLA_WEBHOOK_SECRET } : null),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`planilla_webhook_failed:${res.status}:${text.slice(0, 200)}`);
  }
}

