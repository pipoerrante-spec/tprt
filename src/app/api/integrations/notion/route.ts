import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bookingStatusSchema = z.enum(["pending_payment", "confirmed", "canceled"]);

const getQuerySchema = z.object({
  bookingId: z.string().uuid().optional(),
  status: bookingStatusSchema.optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const postBodySchema = z.object({
  event: z.string().trim().min(1).max(80),
  source: z.string().trim().min(1).max(80).default("notion"),
  recordType: z.string().trim().min(1).max(80).default("external_sync"),
  externalId: z.string().trim().max(120).optional(),
  notionPageId: z.string().trim().max(120).optional(),
  bookingId: z.string().uuid().optional(),
  payload: z.unknown(),
});

function getAccessToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.headers.get("x-tprt-token")?.trim() || "";
}

function assertAuthorized(req: Request) {
  const env = getEnv();
  if (!env.TPRT_EXTERNAL_API_TOKEN) {
    return NextResponse.json({ error: "external_api_not_configured" }, { status: 503 });
  }

  const token = getAccessToken(req);
  if (!token || token !== env.TPRT_EXTERNAL_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET(req: Request) {
  const authError = assertAuthorized(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const parsed = getQuerySchema.safeParse({
    bookingId: url.searchParams.get("bookingId") || undefined,
    status: url.searchParams.get("status") || undefined,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("bookings")
    .select(
      "id,status,date,time,customer_name,email,phone,address,notes,vehicle_plate,vehicle_make,vehicle_model,vehicle_year,service_id,commune_id,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.bookingId) query = query.eq("id", parsed.data.bookingId);
  if (parsed.data.status) query = query.eq("status", parsed.data.status);
  if (parsed.data.dateFrom) query = query.gte("date", parsed.data.dateFrom);
  if (parsed.data.dateTo) query = query.lte("date", parsed.data.dateTo);

  const bookings = await query;
  if (bookings.error) {
    return NextResponse.json({ error: "bookings_unavailable" }, { status: 500 });
  }

  const bookingRows = bookings.data ?? [];
  const bookingIds = bookingRows.map((row) => row.id);
  const serviceIds = [...new Set(bookingRows.map((row) => row.service_id))];
  const communeIds = [...new Set(bookingRows.map((row) => row.commune_id))];

  const [services, communes, payments] = await Promise.all([
    serviceIds.length
      ? supabase.from("services").select("id,name,base_price").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    communeIds.length
      ? supabase.from("communes").select("id,name,region").in("id", communeIds)
      : Promise.resolve({ data: [], error: null }),
    bookingIds.length
      ? supabase
          .from("payments")
          .select("id,booking_id,status,provider,amount_clp,currency,external_ref,created_at")
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (services.error || communes.error || payments.error) {
    return NextResponse.json({ error: "related_data_unavailable" }, { status: 500 });
  }

  const serviceMap = new Map((services.data ?? []).map((row) => [row.id, row]));
  const communeMap = new Map((communes.data ?? []).map((row) => [row.id, row]));
  const paymentMap = new Map<string, (typeof payments.data)[number]>();
  for (const payment of payments.data ?? []) {
    if (!paymentMap.has(payment.booking_id)) paymentMap.set(payment.booking_id, payment);
  }

  return NextResponse.json(
    {
      items: bookingRows.map((booking) => ({
        booking: {
          id: booking.id,
          status: booking.status,
          date: booking.date,
          time: booking.time,
          customerName: booking.customer_name,
          email: booking.email,
          phone: booking.phone,
          address: booking.address,
          notes: booking.notes,
          vehicle: {
            plate: booking.vehicle_plate,
            make: booking.vehicle_make,
            model: booking.vehicle_model,
            year: booking.vehicle_year,
          },
          createdAt: booking.created_at,
        },
        service: serviceMap.get(booking.service_id) ?? null,
        commune: communeMap.get(booking.commune_id) ?? null,
        payment: paymentMap.get(booking.id) ?? null,
      })),
      count: bookingRows.length,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const authError = assertAuthorized(req);
  if (authError) return authError;

  const json = await req.json().catch(() => null);
  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const logInsert = await supabase
    .from("webhooks_log")
    .insert({
      provider: `external_${parsed.data.source}_${parsed.data.event}`.slice(0, 120),
      payload_json: {
        event: parsed.data.event,
        source: parsed.data.source,
        recordType: parsed.data.recordType,
        externalId: parsed.data.externalId ?? null,
        notionPageId: parsed.data.notionPageId ?? null,
        bookingId: parsed.data.bookingId ?? null,
        payload: parsed.data.payload,
      },
      processed: false,
    })
    .select("id,created_at")
    .single();

  if (logInsert.error || !logInsert.data) {
    return NextResponse.json({ error: "webhook_log_failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      webhookId: logInsert.data.id,
      receivedAt: logInsert.data.created_at,
    },
    { status: 202 },
  );
}
