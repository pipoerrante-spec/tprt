import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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
  return NextResponse.json({ services: data }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

