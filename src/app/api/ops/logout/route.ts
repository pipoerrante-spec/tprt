import { NextResponse } from "next/server";
import { clearOpsAuthCookie } from "@/lib/ops-auth";

export const runtime = "nodejs";

export async function POST() {
  await clearOpsAuthCookie();
  return NextResponse.json({ ok: true }, { status: 200 });
}
