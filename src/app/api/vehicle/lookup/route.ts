import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIp, rateLimit } from "@/lib/rate-limit";
import { lookupVehicleByPlate } from "@/lib/vehicle/lookup";

export const runtime = "nodejs";

const schema = z.object({
  plate: z.string().trim().min(3).max(32),
});

export async function POST(req: Request) {
  const ip = getRequestIp(new Headers(req.headers));
  const limit = rateLimit(`vehicle_lookup:${ip}`, { windowMs: 2 * 60_000, max: 20 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited", resetAt: limit.resetAt },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const result = await lookupVehicleByPlate(parsed.data.plate);
  return NextResponse.json({ vehicle: result }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

