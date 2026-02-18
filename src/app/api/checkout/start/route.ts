import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getRequestOrigin } from "@/lib/http";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPaymentsProvider } from "@/lib/payments/provider";

export const runtime = "nodejs";

const startSchema = z.object({
  holdId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  vehiclePlate: z.string().trim().max(12).optional().nullable(),
  address: z.string().trim().min(5).max(160),
  notes: z.string().trim().max(500).optional().nullable(),
  provider: z.enum(["mock", "transbank_webpay", "flow", "mercadopago"]).optional(),
});

export async function POST(req: Request) {
  const ip = getRequestIp(new Headers(req.headers));
  const limit = rateLimit(`checkout:${ip}`, { windowMs: 10 * 60_000, max: 6 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: limit.resetAt },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = startSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const env = getEnv();
  const supabase = getSupabaseAdmin();

  const hold = await supabase.rpc("get_booking_hold_public", { p_hold_id: parsed.data.holdId });
  if (hold.error) return NextResponse.json({ error: "hold_unavailable" }, { status: 500 });
  if (!hold.data?.[0]) return NextResponse.json({ error: "hold_not_found" }, { status: 404 });
  if (hold.data[0].status !== "active") return NextResponse.json({ error: "hold_not_active" }, { status: 409 });

  const attach = await supabase.rpc("attach_customer_to_hold", {
    p_hold_id: parsed.data.holdId,
    p_customer_name: parsed.data.customerName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_vehicle_plate: parsed.data.vehiclePlate ?? null,
  });
  if (attach.error) {
    const message = attach.error.message || "";
    if (message.includes("tprt_hold_not_active")) {
      return NextResponse.json({ error: "hold_not_active" }, { status: 409 });
    }
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }

  const booking = await supabase.rpc("create_booking_from_hold", {
    p_hold_id: parsed.data.holdId,
    p_address: parsed.data.address,
    p_notes: parsed.data.notes ?? null,
  });
  if (booking.error || !booking.data) {
    const message = booking.error?.message || "";
    if (message.includes("tprt_hold_not_active")) return NextResponse.json({ error: "hold_not_active" }, { status: 409 });
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }

  const bookingId = booking.data as unknown as string;
  const bookingRow = await supabase
    .from("bookings")
    .select("id,service_id,email,status")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingRow.error || !bookingRow.data) {
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }

  const serviceRow = await supabase
    .from("services")
    .select("base_price")
    .eq("id", bookingRow.data.service_id)
    .maybeSingle();
  if (serviceRow.error || !serviceRow.data) {
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }

  const amountClp = serviceRow.data.base_price;
  const providerId = parsed.data.provider ?? env.TPRT_PAYMENTS_PROVIDER_ACTIVE;
  const provider = getPaymentsProvider(providerId);

  const payment = await supabase.rpc("create_payment_for_booking", {
    p_booking_id: bookingId,
    p_provider: providerId,
    p_amount_clp: amountClp,
    p_external_ref: null,
  });
  if (payment.error || !payment.data) {
    return NextResponse.json({ error: "payment_init_failed" }, { status: 500 });
  }

  const paymentId = payment.data as unknown as string;

  let session;
  try {
    session = await provider.createCheckoutSession({
      paymentId,
      bookingId,
      amountClp,
      currency: "CLP",
      customerEmail: bookingRow.data.email,
      returnUrl: `${getRequestOrigin(req)}/confirmacion/${encodeURIComponent(bookingId)}`,
    });
  } catch (e) {
    await supabase.from("payments").update({ status: "failed" }).eq("id", paymentId);
    const message = e instanceof Error ? e.message : "payment_provider_error";
    return NextResponse.json({ error: message }, { status: 501 });
  }

  if (session.externalRef) {
    await supabase.from("payments").update({ external_ref: session.externalRef }).eq("id", paymentId);
  }

  return NextResponse.json(
    { bookingId, paymentId, provider: providerId, redirectUrl: session.redirectUrl, amountClp },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

