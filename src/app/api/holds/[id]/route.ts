import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid() });

const patchSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(30),
  vehiclePlate: z.string().trim().max(12).optional().nullable(),
});

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_booking_hold_public", { p_hold_id: parsed.data.id });
  if (error) return NextResponse.json({ error: "hold_unavailable" }, { status: 500 });
  if (!data?.[0]) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ hold: data[0] }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("attach_customer_to_hold", {
    p_hold_id: parsedParams.data.id,
    p_customer_name: parsed.data.customerName,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_vehicle_plate: parsed.data.vehiclePlate ?? null,
  });

  if (error) {
    const message = error.message || "";
    if (message.includes("tprt_hold_not_active")) {
      return NextResponse.json({ error: "hold_not_active" }, { status: 409 });
    }
    return NextResponse.json({ error: "hold_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
