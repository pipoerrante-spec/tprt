import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id,booking_id,provider,amount_clp,currency,status,external_ref,authorization_code,card_last4,response_code,payment_type_code,transbank_status,transbank_buy_order,transbank_session_id,transbank_vci,transbank_transaction_date,created_at",
    )
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "payment_unavailable" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ payment: data }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
