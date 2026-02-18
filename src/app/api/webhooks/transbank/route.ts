import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST() {
  const env = getEnv();
  if (!env.TRANSBANK_COMMERCE_CODE || !env.TRANSBANK_API_KEY) {
    return NextResponse.json({ error: "transbank_not_configured" }, { status: 501 });
  }

  // Prepared webhook endpoint:
  // - validate signature (if applicable)
  // - map external ref -> payment id
  // - call `set_payment_status` RPC
  return NextResponse.json({ error: "transbank_not_implemented" }, { status: 501 });
}

