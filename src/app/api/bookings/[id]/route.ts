import { NextResponse } from "next/server";
import { z } from "zod";
import { getBookingConfirmation } from "@/lib/bookings/get-booking-confirmation";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const result = await getBookingConfirmation(parsed.data.id);

  if (result.error === "booking_unavailable") {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  if (result.error === "not_found") {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result.data, { status: 200, headers: { "Cache-Control": "no-store" } });
}
