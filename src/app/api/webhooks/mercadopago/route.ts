import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueBookingPaidJobs, flushImmediateNotificationJobs } from "@/lib/notifications/jobs";

export const runtime = "nodejs";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function extractPaymentId(url: URL, body: unknown) {
  const qpId = url.searchParams.get("id");
  const qpTopic = url.searchParams.get("topic") || url.searchParams.get("type");
  if (qpId && (!qpTopic || qpTopic.includes("payment"))) return qpId;

  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const type = String((b.type as unknown) ?? (b.topic as unknown) ?? "");
  const data = b.data as Record<string, unknown> | undefined;
  const dataId = data?.id as unknown;
  const id = typeof dataId === "string" || typeof dataId === "number" ? String(dataId) : null;
  if (id && (!type || type.includes("payment"))) return id;
  return null;
}

async function handle(req: Request) {
  const env = getEnv();
  if (!env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json({ error: "mercadopago_not_configured" }, { status: 501 });
  }

  const url = new URL(req.url);
  const json = req.method === "POST" ? await req.json().catch(() => null) : null;
  const mpPaymentId = extractPaymentId(url, json);
  if (!mpPaymentId) return NextResponse.json({ ok: true }, { status: 200 });

  const client = new MercadoPagoConfig({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN });
  const paymentApi = new Payment(client);

  const payment = (await paymentApi.get({ id: mpPaymentId })) as Record<string, unknown>;
  const status = String(payment.status ?? "");
  const externalReference = String(payment.external_reference ?? "");

  const supabase = getSupabaseAdmin();
  try {
    await supabase.from("webhooks_log").insert({
      provider: "mercadopago",
      payload_json: { mpPaymentId, status, externalReference, raw: json },
      processed: true,
    });
  } catch {
    // ignore
  }

  if (!isUuid(externalReference)) return NextResponse.json({ ok: true }, { status: 200 });

  let mapped: "paid" | "failed" | "refunded" | null = null;
  if (status === "approved") mapped = "paid";
  else if (status === "rejected" || status === "cancelled") mapped = "failed";
  else if (status === "refunded" || status === "charged_back") mapped = "refunded";
  else mapped = null;

  if (!mapped) return NextResponse.json({ ok: true }, { status: 200 });

  await supabase.rpc("set_payment_status", {
    p_payment_id: externalReference,
    p_status: mapped,
    p_external_ref: null,
  });

  if (mapped === "paid") {
    const pay = await supabase.from("payments").select("booking_id").eq("id", externalReference).maybeSingle();
    const bookingId = pay.data?.booking_id ?? null;
    if (bookingId) {
      await enqueueBookingPaidJobs(bookingId).catch(() => null);
      await flushImmediateNotificationJobs({ limit: 10, passes: 3 }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
