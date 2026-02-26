import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { QA_SERVICE_PRICE_CLP } from "@/lib/pricing";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("services")
    .select("id,name,description,base_price,duration_minutes,active")
    .eq("active", true)
    .order("base_price", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 500 });
  }
  const mapped = (data ?? []).map((s) => ({
    ...s,
    base_price: QA_SERVICE_PRICE_CLP,
  }));
  const preferred = mapped.find((s) => s.name === "Revisión técnica inteligente");
  const services = preferred ? [preferred] : mapped.slice(0, 1);
  return NextResponse.json({ services }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
