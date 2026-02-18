import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid() });

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "—";
  const safeUser = user.length <= 2 ? `${user[0]}*` : `${user.slice(0, 2)}***`;
  return `${safeUser}@${domain}`;
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const booking = await supabase
    .from("bookings")
    .select("id,status,date,time,customer_name,email,phone,service_id,commune_id,created_at")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (booking.error) return NextResponse.json({ error: "booking_unavailable" }, { status: 500 });
  if (!booking.data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const service = await supabase
    .from("services")
    .select("id,name")
    .eq("id", booking.data.service_id)
    .maybeSingle();
  const commune = await supabase
    .from("communes")
    .select("id,name,region")
    .eq("id", booking.data.commune_id)
    .maybeSingle();

  const payment = await supabase
    .from("payments")
    .select("id,status,provider,amount_clp,currency,created_at")
    .eq("booking_id", booking.data.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(
    {
      booking: {
        id: booking.data.id,
        status: booking.data.status,
        date: booking.data.date,
        time: booking.data.time,
        customerName: booking.data.customer_name,
        emailMasked: maskEmail(booking.data.email),
        service: service.data ?? null,
        commune: commune.data ?? null,
        createdAt: booking.data.created_at,
      },
      payment: payment.data ?? null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
