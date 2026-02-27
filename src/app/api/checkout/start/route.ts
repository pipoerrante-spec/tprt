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

type HoldPublic = {
  id: string;
  service_id: string;
  commune_id: string;
  date: string;
  time: string;
  expires_at: string;
  status: "active" | "expired" | "converted" | "canceled";
};

type HoldForQa = {
  id: string;
  service_id: string;
  commune_id: string;
  date: string;
  time: string;
  expires_at: string;
  status: "active" | "expired" | "converted" | "canceled";
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
};

async function getHoldPublicSafe(supabase: ReturnType<typeof getSupabaseAdmin>, holdId: string) {
  const rpc = await supabase.rpc("get_booking_hold_public", { p_hold_id: holdId });
  if (!rpc.error && rpc.data?.[0]) {
    return { hold: rpc.data[0] as HoldPublic, error: null as null | "hold_unavailable" };
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("booking_holds")
    .update({ status: "expired" })
    .eq("id", holdId)
    .eq("status", "active")
    .lte("expires_at", nowIso);

  const fallback = await supabase
    .from("booking_holds")
    .select("id,service_id,commune_id,date,time,expires_at,status")
    .eq("id", holdId)
    .maybeSingle();
  if (fallback.error) {
    return { hold: null, error: "hold_unavailable" as const };
  }
  return { hold: (fallback.data as HoldPublic | null) ?? null, error: null as null | "hold_unavailable" };
}

async function createBookingFromHoldQaFallback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  holdId: string,
  input: {
    customerName: string;
    email: string;
    phone: string;
    vehiclePlate: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number | null;
    address: string;
    notes: string | null;
  },
) {
  const nowIso = new Date().toISOString();

  const holdRes = await supabase
    .from("booking_holds")
    .select(
      "id,service_id,commune_id,date,time,expires_at,status,customer_name,email,phone,vehicle_plate,vehicle_make,vehicle_model,vehicle_year",
    )
    .eq("id", holdId)
    .maybeSingle();
  if (holdRes.error || !holdRes.data) return { bookingId: null as string | null, error: "hold_not_found" as const };

  const hold = holdRes.data as HoldForQa;
  if (hold.status !== "active" || hold.expires_at <= nowIso) return { bookingId: null as string | null, error: "hold_not_active" as const };

  const patch = await supabase
    .from("booking_holds")
    .update({
      customer_name: input.customerName,
      email: input.email,
      phone: input.phone,
      vehicle_plate: input.vehiclePlate,
      vehicle_make: input.vehicleMake,
      vehicle_model: input.vehicleModel,
      vehicle_year: input.vehicleYear ?? null,
    })
    .eq("id", holdId)
    .eq("status", "active")
    .gt("expires_at", nowIso);
  if (patch.error) return { bookingId: null as string | null, error: "checkout_failed" as const };

  // In QA/demo we convert hold first to avoid counting both hold+booking in capacity checks.
  const convert = await supabase
    .from("booking_holds")
    .update({ status: "converted" })
    .eq("id", holdId)
    .eq("status", "active")
    .gt("expires_at", nowIso)
    .select("id")
    .maybeSingle();
  if (convert.error || !convert.data) {
    const existing = await supabase
      .from("bookings")
      .select("id")
      .eq("hold_id", holdId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error || !existing.data?.id) return { bookingId: null as string | null, error: "hold_not_active" as const };
    return { bookingId: existing.data.id as string, error: null as null };
  }

  const freshHoldRes = await supabase
    .from("booking_holds")
    .select("service_id,commune_id,date,time,customer_name,email,phone,vehicle_plate,vehicle_make,vehicle_model,vehicle_year")
    .eq("id", holdId)
    .maybeSingle();
  if (freshHoldRes.error || !freshHoldRes.data) return { bookingId: null as string | null, error: "checkout_failed" as const };
  const fresh = freshHoldRes.data as Omit<HoldForQa, "id" | "expires_at" | "status">;

  const created = await supabase
    .from("bookings")
    .insert({
      hold_id: holdId,
      service_id: fresh.service_id,
      commune_id: fresh.commune_id,
      date: fresh.date,
      time: fresh.time,
      customer_name: fresh.customer_name ?? input.customerName,
      email: fresh.email ?? input.email,
      phone: fresh.phone ?? input.phone,
      address: input.address.trim(),
      notes: input.notes ?? null,
      vehicle_plate: fresh.vehicle_plate ?? input.vehiclePlate,
      vehicle_make: fresh.vehicle_make ?? input.vehicleMake,
      vehicle_model: fresh.vehicle_model ?? input.vehicleModel,
      vehicle_year: fresh.vehicle_year ?? input.vehicleYear ?? null,
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (created.error || !created.data?.id) {
    await supabase.from("booking_holds").update({ status: "active" }).eq("id", holdId).eq("status", "converted");
    const message = created.error?.message || "";
    if (message.includes("tprt_slot_full")) return { bookingId: null as string | null, error: "slot_full" as const };
    if (message.includes("tprt_slot_not_available")) return { bookingId: null as string | null, error: "slot_not_available" as const };
    return { bookingId: null as string | null, error: "checkout_failed" as const };
  }

  return { bookingId: created.data.id as string, error: null as null };
}

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

  const holdResult = await getHoldPublicSafe(supabase, parsed.data.holdId);
  if (holdResult.error) return NextResponse.json({ error: holdResult.error }, { status: 500 });

  const holdRow = holdResult.hold;
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
      if ((message.includes("tprt_slot_full") || message.includes("tprt_slot_not_available")) && env.TRANSBANK_ENV === "qa") {
        const qaFallback = await createBookingFromHoldQaFallback(supabase, parsed.data.holdId, {
          customerName: parsed.data.customerName,
          email: parsed.data.email,
          phone: parsed.data.phone,
          vehiclePlate: parsed.data.vehiclePlate,
          vehicleMake: parsed.data.vehicleMake,
          vehicleModel: parsed.data.vehicleModel,
          vehicleYear: parsed.data.vehicleYear ?? null,
          address: parsed.data.address,
          notes: parsed.data.notes ?? null,
        });
        if (!qaFallback.error && qaFallback.bookingId) {
          bookingId = qaFallback.bookingId;
        } else if (qaFallback.error === "hold_not_active") {
          return NextResponse.json({ error: "hold_not_active" }, { status: 409 });
        } else if (qaFallback.error === "slot_full") {
          return NextResponse.json({ error: "slot_full" }, { status: 409 });
        } else if (qaFallback.error === "slot_not_available") {
          return NextResponse.json({ error: "slot_not_available" }, { status: 409 });
        } else if (qaFallback.error) {
          return NextResponse.json({ error: qaFallback.error }, { status: 500 });
        }
      } else if (message.includes("tprt_slot_full")) {
        return NextResponse.json({ error: "slot_full" }, { status: 409 });
      } else if (message.includes("tprt_slot_not_available")) {
        return NextResponse.json({ error: "slot_not_available" }, { status: 409 });
      } else {
        return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
      }
    } else {
      bookingId = booking.data as unknown as string;
    }
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

  const paidPayment = await supabase
    .from("payments")
    .select("id,provider,amount_clp,currency")
    .eq("booking_id", bookingId)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paidPayment.error) {
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
  if (paidPayment.data) {
    return NextResponse.json(
      {
        bookingId,
        paymentId: paidPayment.data.id,
        provider: paidPayment.data.provider,
        redirectUrl: `/confirmacion/${encodeURIComponent(bookingId)}`,
        amountClp: paidPayment.data.amount_clp,
        baseAmountClp: paidPayment.data.amount_clp,
        discountAmountClp: 0,
        discountPercent: 0,
        couponCode: null,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
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
