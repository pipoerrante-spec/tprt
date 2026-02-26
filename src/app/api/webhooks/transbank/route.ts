import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getRequestOrigin } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueBookingPaidJobs, processDueNotificationJobs } from "@/lib/notifications/jobs";
import { Environment, Options, WebpayPlus } from "transbank-sdk";

export const runtime = "nodejs";

function checkSecret(req: Request) {
  const env = getEnv();
  if (!env.TRANSBANK_RETURN_SECRET) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === env.TRANSBANK_RETURN_SECRET;
}

function redirectToConfirmation(origin: string, bookingId: string) {
  return NextResponse.redirect(new URL(`/confirmacion/${encodeURIComponent(bookingId)}`, origin), { status: 303 });
}

function redirectToHelp(origin: string) {
  return NextResponse.redirect(new URL("/ayuda", origin), { status: 303 });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function getPaymentByToken(token: string) {
  const supabase = getSupabaseAdmin();
  const res = await supabase
    .from("payments")
    .select("id,booking_id")
    .eq("provider", "transbank_webpay")
    .eq("external_ref", token)
    .order("created_at", { ascending: false })
    .limit(1);
  if (res.error) return null;
  return res.data?.[0] ?? null;
}

export async function POST(req: Request) {
  const env = getEnv();
  if (!env.TRANSBANK_COMMERCE_CODE || !env.TRANSBANK_API_KEY || !env.TRANSBANK_ENV) {
    return NextResponse.json({ error: "transbank_not_configured" }, { status: 501 });
  }
  if (!checkSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const origin = getRequestOrigin(req);

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const tokenWs = form.get("token_ws");
  const tbkOrder = form.get("TBK_ORDEN_COMPRA");
  const tbkSession = form.get("TBK_ID_SESION");

  const token = typeof tokenWs === "string" ? tokenWs : null;
  const maybePaymentId = typeof tbkOrder === "string" ? tbkOrder : null;
  const maybeSessionPaymentId = typeof tbkSession === "string" ? tbkSession : null;

  const supabase = getSupabaseAdmin();

  const envMode = env.TRANSBANK_ENV === "production" ? Environment.Production : Environment.Integration;
  const options = new Options(env.TRANSBANK_COMMERCE_CODE, env.TRANSBANK_API_KEY, envMode);
  const tx = new WebpayPlus.Transaction(options);

  try {
    if (!token) {
      const failedPaymentId = isUuid(String(maybeSessionPaymentId ?? ""))
        ? String(maybeSessionPaymentId)
        : isUuid(String(maybePaymentId ?? ""))
          ? String(maybePaymentId)
          : null;
      if (failedPaymentId) {
        await supabase.rpc("set_payment_status", {
          p_payment_id: failedPaymentId,
          p_status: "failed",
          p_external_ref: null,
        });
        const pay = await supabase.from("payments").select("booking_id").eq("id", failedPaymentId).maybeSingle();
        if (pay.data?.booking_id) return redirectToConfirmation(origin, pay.data.booking_id);
      }
      return redirectToHelp(origin);
    }

    const committed = await tx.commit(token);
    const committedBuyOrder = String((committed as { buy_order?: string }).buy_order ?? "");
    const committedSessionId = String((committed as { session_id?: string }).session_id ?? "");

    let paymentId: string | null = null;
    let bookingId: string | null = null;

    if (isUuid(committedSessionId)) {
      paymentId = committedSessionId;
    } else if (isUuid(committedBuyOrder)) {
      // Backwards compatibility for older transactions where buy_order carried payment UUID.
      paymentId = committedBuyOrder;
    } else {
      const byToken = await getPaymentByToken(token);
      paymentId = byToken?.id ?? null;
      bookingId = byToken?.booking_id ?? null;
    }

    if (paymentId && !bookingId) {
      bookingId = (await supabase.from("payments").select("booking_id").eq("id", paymentId).maybeSingle()).data?.booking_id ?? null;
    }

    const status = (committed as { status?: string }).status ?? null;
    const responseCode = Number((committed as { response_code?: unknown }).response_code);
    const isPaid = status === "AUTHORIZED" && responseCode === 0;
    const mappedStatus = isPaid ? "paid" : "failed";

    if (paymentId && isUuid(paymentId)) {
      await supabase.rpc("set_payment_status", {
        p_payment_id: paymentId,
        p_status: mappedStatus,
        p_external_ref: token,
      });
      if (mappedStatus === "paid" && bookingId) {
        await enqueueBookingPaidJobs(bookingId).catch(() => null);
        await processDueNotificationJobs({ limit: 10 }).catch(() => null);
      }
    }

    if (bookingId) return redirectToConfirmation(origin, bookingId);
    return redirectToHelp(origin);
  } catch {
    return redirectToHelp(origin);
  }
}

export async function GET(req: Request) {
  const origin = getRequestOrigin(req);
  return NextResponse.redirect(new URL("/ayuda", origin), { status: 303 });
}
