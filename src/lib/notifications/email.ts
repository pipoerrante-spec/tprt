import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function sendBookingConfirmationEmail(bookingId: string) {
  const env = getEnv();
  const supabase = getSupabaseAdmin();

  const booking = await supabase
    .from("bookings")
    .select("id,status,date,time,customer_name,email,service_id,commune_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (booking.error || !booking.data) throw new Error("booking_not_found");

  const service = await supabase
    .from("services")
    .select("name,base_price")
    .eq("id", booking.data.service_id)
    .maybeSingle();
  const commune = await supabase
    .from("communes")
    .select("name,region")
    .eq("id", booking.data.commune_id)
    .maybeSingle();

  const payment = await supabase
    .from("payments")
    .select("status,provider,amount_clp,currency,created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subject = `TPRT — Confirmación de reserva ${booking.data.id}`;
  const total = payment.data?.amount_clp ?? service.data?.base_price ?? 0;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui; line-height:1.5; color:#0b1220">
      <h2>Reserva confirmada</h2>
      <p>Hola ${booking.data.customer_name},</p>
      <p>Tu reserva está <b>${booking.data.status}</b>.</p>
      <ul>
        <li><b>Servicio:</b> ${service.data?.name ?? "—"}</li>
        <li><b>Comuna:</b> ${commune.data?.name ?? "—"} (${commune.data?.region ?? "—"})</li>
        <li><b>Fecha:</b> ${booking.data.date}</li>
        <li><b>Hora:</b> ${booking.data.time}</li>
        <li><b>Total:</b> ${formatClp(total)}</li>
      </ul>
      <p><b>ID de reserva:</b> ${booking.data.id}</p>
      <p>Si necesitas soporte, responde este correo indicando tu ID.</p>
      <hr />
      <p style="font-size:12px;color:#5b6777">Privacidad: usamos tus datos solo para esta gestión y soporte.</p>
    </div>
  `;

  if (env.EMAIL_PROVIDER === "console") {
    console.log("[TPRT][email][console]", {
      to: booking.data.email,
      subject,
      bookingId,
      provider: payment.data?.provider ?? null,
      paymentStatus: payment.data?.status ?? null,
      htmlPreview: html.replace(/\\s+/g, " ").slice(0, 240) + "…",
    });
    return;
  }

  throw new Error("email_provider_not_configured");
}

export async function scheduleRemindersStub(bookingId: string) {
  console.log("[TPRT][reminders][stub]", { bookingId });
}

