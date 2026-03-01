import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { getRequestOrigin } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueBookingPaidJobs, processDueNotificationJobs } from "@/lib/notifications/jobs";
import { WebpayPlus } from "transbank-sdk";
import { getTransbankOptions } from "@/lib/payments/transbank-config";

export const runtime = "nodejs";

type TransbankReturnParams = {
  tokenWs: string | null;
  tbkToken: string | null;
  tbkOrder: string | null;
  tbkSession: string | null;
};

type TransbankCommitResponse = {
  status?: string;
  response_code?: number;
  buy_order?: string;
  session_id?: string;
  authorization_code?: string;
  payment_type_code?: string;
  vci?: string;
  transaction_date?: string;
  card_detail?: {
    card_number?: string;
  } | null;
};

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

function buildGatewayMetadata(response: TransbankCommitResponse) {
  return {
    authorization_code: response.authorization_code ?? null,
    card_last4: response.card_detail?.card_number ?? null,
    response_code: typeof response.response_code === "number" ? response.response_code : null,
    payment_type_code: response.payment_type_code ?? null,
    transbank_status: response.status ?? null,
    transbank_buy_order: response.buy_order ?? null,
    transbank_session_id: response.session_id ?? null,
    transbank_vci: response.vci ?? null,
    transbank_transaction_date: response.transaction_date ?? null,
    gateway_response: response,
  };
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

function pickString(value: FormDataEntryValue | string | null) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function readReturnParams(req: Request): Promise<TransbankReturnParams | null> {
  const url = new URL(req.url);
  if (req.method === "GET") {
    return {
      tokenWs: pickString(url.searchParams.get("token_ws")),
      tbkToken: pickString(url.searchParams.get("TBK_TOKEN")),
      tbkOrder: pickString(url.searchParams.get("TBK_ORDEN_COMPRA")),
      tbkSession: pickString(url.searchParams.get("TBK_ID_SESION")),
    };
  }

  const form = await req.formData().catch(() => null);
  if (!form) return null;
  return {
    tokenWs: pickString(form.get("token_ws")),
    tbkToken: pickString(form.get("TBK_TOKEN")),
    tbkOrder: pickString(form.get("TBK_ORDEN_COMPRA")),
    tbkSession: pickString(form.get("TBK_ID_SESION")),
  };
}

async function handleTransbankReturn(req: Request) {
  const env = getEnv();
  if (!env.TRANSBANK_ENV) {
    return NextResponse.json({ error: "transbank_not_configured" }, { status: 501 });
  }
  if (!checkSecret(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const origin = getRequestOrigin(req);
  const params = await readReturnParams(req);
  if (!params) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const token = params.tokenWs;
  const supabase = getSupabaseAdmin();

  const tx = new WebpayPlus.Transaction(getTransbankOptions());

  try {
    if (!token) {
      const failedPaymentId = isUuid(String(params.tbkSession ?? ""))
        ? String(params.tbkSession)
        : isUuid(String(params.tbkOrder ?? ""))
          ? String(params.tbkOrder)
          : null;
      const byAbortToken = params.tbkToken ? await getPaymentByToken(params.tbkToken) : null;
      const paymentId = failedPaymentId ?? byAbortToken?.id ?? null;

      if (paymentId) {
        await supabase.rpc("set_payment_status", {
          p_payment_id: paymentId,
          p_status: "failed",
          p_external_ref: params.tbkToken ?? null,
        });
        await supabase
          .from("payments")
          .update({
            transbank_status: "ABORTED",
            transbank_buy_order: params.tbkOrder,
            transbank_session_id: params.tbkSession,
            gateway_response: {
              TBK_TOKEN: params.tbkToken,
              TBK_ORDEN_COMPRA: params.tbkOrder,
              TBK_ID_SESION: params.tbkSession,
            },
          })
          .eq("id", paymentId);
      }

      const failedBookingId =
        byAbortToken?.booking_id ??
        (paymentId
          ? (await supabase.from("payments").select("booking_id").eq("id", paymentId).maybeSingle()).data?.booking_id ?? null
          : null);

      if (failedBookingId) {
        return redirectToConfirmation(origin, failedBookingId);
      }

      if (params.tbkToken) {
        const knownPayment = await getPaymentByToken(params.tbkToken);
        if (knownPayment?.booking_id) return redirectToConfirmation(origin, knownPayment.booking_id);
      }

      return redirectToHelp(origin);
    }

    const committed = (await tx.commit(token)) as TransbankCommitResponse;
    const committedBuyOrder = String(committed.buy_order ?? "");
    const committedSessionId = String(committed.session_id ?? "");

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

    const status = committed.status ?? null;
    const responseCode = Number(committed.response_code);
    const isPaid = status === "AUTHORIZED" && responseCode === 0;
    const mappedStatus = isPaid ? "paid" : "failed";

    if (paymentId && isUuid(paymentId)) {
      await supabase.rpc("set_payment_status", {
        p_payment_id: paymentId,
        p_status: mappedStatus,
        p_external_ref: token,
      });
      await supabase.from("payments").update(buildGatewayMetadata(committed)).eq("id", paymentId);
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

export async function POST(req: Request) {
  return handleTransbankReturn(req);
}

export async function GET(req: Request) {
  return handleTransbankReturn(req);
}
