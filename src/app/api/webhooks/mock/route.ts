import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enqueueBookingPaidJobs, processDueNotificationJobs } from "@/lib/notifications/jobs";

export const runtime = "nodejs";

const payloadSchema = z.object({
  paymentId: z.string().uuid(),
  status: z.enum(["paid", "failed"]),
  externalRef: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const env = getEnv();
  if (env.TPRT_MOCK_WEBHOOK_SECRET) {
    const provided = req.headers.get("x-tprt-mock-secret");
    if (!provided || provided !== env.TPRT_MOCK_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const json = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const logInsert = await supabase
    .from("webhooks_log")
    .insert({
      provider: "mock",
      payload_json: parsed.data,
      processed: false,
    })
    .select("id")
    .single();

  const { error } = await supabase.rpc("set_payment_status", {
    p_payment_id: parsed.data.paymentId,
    p_status: parsed.data.status,
    p_external_ref: parsed.data.externalRef ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "webhook_failed" }, { status: 500 });
  }

  if (logInsert.data?.id) {
    await supabase.from("webhooks_log").update({ processed: true }).eq("id", logInsert.data.id);
  }

  if (parsed.data.status === "paid") {
    const payment = await supabase
      .from("payments")
      .select("booking_id")
      .eq("id", parsed.data.paymentId)
      .maybeSingle();
    const bookingId = payment.data?.booking_id;
    if (bookingId) {
      await enqueueBookingPaidJobs(bookingId).catch(() => null);
      await processDueNotificationJobs({ limit: 10 }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
