import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidOpsCredentials, setOpsAuthCookie } from "@/lib/ops-auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!isValidOpsCredentials(parsed.data.username, parsed.data.password)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await setOpsAuthCookie();
  return NextResponse.json({ ok: true }, { status: 200 });
}
