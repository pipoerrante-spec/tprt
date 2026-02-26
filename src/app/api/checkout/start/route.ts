import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getRequestOrigin } from "@/lib/http";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getPaymentsProvider } from "@/lib/payments/provider";
import {
  QA_SERVICE_PRICE_CLP,
  applyDiscount,
  getCouponDiscountPercent,
  normalizeCouponCode,
} from "@/lib/pricing";

export const runtime = "nodejs";

const startSchema = z.object({
  holdId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  vehiclePlate: z.string().trim().min(5).max(12),
  vehicleMake: z.string().trim().min(2).max(40),
  vehicleModel: z.string().trim().min(1).max(60),
  vehicleYear: z.number().int().min(1950).max(new Date().getFullYear() + 1).optional().nullable(),
  address: z.string().trim().min(5).max(160),
  notes: z.string().trim().max(500).optional().nullable(),
  couponCode: z.string().trim().max(32).optional().nullable(),
  provider: z.enum(["transbank_webpay", "mercadopago"]).optional(),
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

  const holdRow = hold.data?.[0] ?? null;
  let bookingId: string | null = null;

  if (!holdRow || holdRow.status === "converted") {
    const existing = await supabase
      .from("bookings")
      .select("id,status")
      .eq("hold_id", parsed.data.holdId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
    if (!existing.data?.id) {
      return NextResponse.json({ error: holdRow ? "hold_not_active" : "hold_not_found" }, { status: holdRow ? 409 : 404 });
    }
    bookingId = existing.data.id;
  } else if (holdRow.status === "active") {
    const attach = await supabase.rpc("attach_customer_to_hold", {
      p_hold_id: parsed.data.holdId,
      p_customer_name: parsed.data.customerName,
      p_email: parsed.data.email,
      p_phone: parsed.data.phone,
      p_vehicle_plate: parsed.data.vehiclePlate,
      p_vehicle_make: parsed.data.vehicleMake,
      p_vehicle_model: parsed.data.vehicleModel,
      p_vehicle_year: parsed.data.vehicleYear ?? null,
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

    bookingId = booking.data as unknown as string;
  } else {
    return NextResponse.json({ error: "hold_not_active" }, { status: 409 });
  }

  if (!bookingId) {
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }

  const patchBooking = await supabase
    .from("bookings")
    .update({
      customer_name: parsed.data.customerName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      notes: parsed.data.notes ?? null,
      vehicle_plate: parsed.data.vehiclePlate,
      vehicle_make: parsed.data.vehicleMake,
      vehicle_model: parsed.data.vehicleModel,
      vehicle_year: parsed.data.vehicleYear ?? null,
    })
    .eq("id", bookingId);
  if (patchBooking.error) {
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }

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

  const baseAmountClp = QA_SERVICE_PRICE_CLP;
  const couponCode = normalizeCouponCode(parsed.data.couponCode);
  const discountPercent = getCouponDiscountPercent(couponCode);
  if (couponCode && discountPercent <= 0) {
    return NextResponse.json({ error: "invalid_coupon" }, { status: 400 });
  }
  const { discountAmountClp, finalAmountClp } = applyDiscount(baseAmountClp, discountPercent);
  const amountClp = finalAmountClp;
  const providerId = parsed.data.provider ?? (env.TPRT_PAYMENTS_PROVIDER_ACTIVE === "mercadopago" ? "mercadopago" : "transbank_webpay");
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
    {
      bookingId,
      paymentId,
      provider: providerId,
      redirectUrl: session.redirectUrl,
      amountClp,
      baseAmountClp,
      discountAmountClp,
      discountPercent,
      couponCode,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
