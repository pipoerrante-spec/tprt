import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { processDueNotificationJobs } from "@/lib/notifications/jobs";

export const runtime = "nodejs";

function authorize(req: Request) {
  const env = getEnv();
  if (!env.TPRT_CRON_SECRET) return true;

  const header = req.headers.get("x-tprt-cron-secret");
  if (header && header === env.TPRT_CRON_SECRET) return true;

  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${env.TPRT_CRON_SECRET}`) return true;

  const url = new URL(req.url);
  const qp = url.searchParams.get("secret");
  if (qp && qp === env.TPRT_CRON_SECRET) return true;

  return false;
}

export async function GET(req: Request) {
  if (!authorize(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await processDueNotificationJobs({ limit: 25 });
  return NextResponse.json({ ok: true, ...result }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  return GET(req);
}

