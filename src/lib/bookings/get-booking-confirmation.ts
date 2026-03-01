import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type BookingConfirmationResponse = {
  booking: {
    id: string;
    status: "pending_payment" | "confirmed" | "canceled" | "completed";
    date: string;
    time: string;
    customerName: string;
    emailMasked: string;
    service: { id: string; name: string } | null;
    commune: { id: string; name: string; region: string } | null;
    createdAt: string;
  };
  payment: {
    id: string;
    status: "pending" | "paid" | "failed" | "refunded";
    provider: string;
    amount_clp: number;
    currency: string;
    created_at: string;
    authorization_code?: string | null;
    card_last4?: string | null;
    response_code?: number | null;
    payment_type_code?: string | null;
    transbank_status?: string | null;
    transbank_buy_order?: string | null;
    transbank_session_id?: string | null;
    transbank_vci?: string | null;
    transbank_transaction_date?: string | null;
  } | null;
};

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "—";
  const safeUser = user.length <= 2 ? `${user[0]}*` : `${user.slice(0, 2)}***`;
  return `${safeUser}@${domain}`;
}

export async function getBookingConfirmation(bookingId: string) {
  const supabase = getSupabaseAdmin();

  const booking = await supabase
    .from("bookings")
    .select("id,status,date,time,customer_name,email,phone,service_id,commune_id,created_at")
    .eq("id", bookingId)
    .maybeSingle();

  if (booking.error) return { data: null, error: "booking_unavailable" as const };
  if (!booking.data) return { data: null, error: "not_found" as const };

  const [service, commune, payment] = await Promise.all([
    supabase.from("services").select("id,name").eq("id", booking.data.service_id).maybeSingle(),
    supabase.from("communes").select("id,name,region").eq("id", booking.data.commune_id).maybeSingle(),
    supabase
      .from("payments")
      .select(
        "id,status,provider,amount_clp,currency,created_at,authorization_code,card_last4,response_code,payment_type_code,transbank_status,transbank_buy_order,transbank_session_id,transbank_vci,transbank_transaction_date",
      )
      .eq("booking_id", booking.data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    data: {
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
    } satisfies BookingConfirmationResponse,
    error: null as null,
  };
}
