import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TZ = "America/Santiago";

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

type SendEmailInput = {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(res: Response) {
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }

  const reset = res.headers.get("ratelimit-reset");
  if (reset) {
    const unixSeconds = Number(reset);
    if (Number.isFinite(unixSeconds) && unixSeconds > 0) {
      const ms = unixSeconds * 1000 - Date.now();
      if (ms > 0) return ms;
    }
  }

  return 1_000;
}

function normalizeRecipients(value?: string | string[] | null) {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function sendEmail({ to, cc, subject, html }: SendEmailInput) {
  const env = getEnv();
  const toRecipients = normalizeRecipients(to);
  const ccRecipients = normalizeRecipients(cc);

  if (env.EMAIL_PROVIDER === "console") {
    console.log("[TPRT][email][console]", {
      to: toRecipients,
      cc: ccRecipients,
      subject,
      htmlPreview: html.replace(/\\s+/g, " ").slice(0, 240) + "…",
    });
    return;
  }

  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) throw new Error("resend_not_configured");
    if (!env.EMAIL_FROM) throw new Error("email_from_not_configured");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: toRecipients,
          ...(ccRecipients.length > 0 ? { cc: ccRecipients } : null),
          subject,
          html,
          ...(env.TPRT_SUPPORT_EMAIL ? { reply_to: env.TPRT_SUPPORT_EMAIL } : null),
        }),
      });
      if (res.ok) {
        return;
      }

      const text = await res.text().catch(() => "");
      const transient = res.status === 429 || res.status >= 500;
      if (transient && attempt < 2) {
        await sleep(parseRetryAfterMs(res) + attempt * 250);
        continue;
      }
      throw new Error(`resend_failed:${res.status}:${text.slice(0, 200)}`);
    }
  }

  throw new Error("email_provider_not_configured");
}

function safeTimeShort(time: string) {
  return time.length >= 5 ? time.slice(0, 5) : time;
}

function bookingLocalDateTime(date: string, time: string) {
  const hhmm = safeTimeShort(time);
  // Interpret as local time in Chile and convert to UTC date.
  return fromZonedTime(new Date(`${date}T${hhmm}:00`), TZ);
}

export async function sendBookingConfirmationEmail(bookingId: string) {
  const supabase = getSupabaseAdmin();

  const booking = await supabase
    .from("bookings")
    .select(
      "id,status,date,time,customer_name,email,phone,address,notes,vehicle_plate,vehicle_make,vehicle_model,vehicle_year,service_id,commune_id",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (booking.error || !booking.data) throw new Error("booking_not_found");

  const service = await supabase
    .from("services")
    .select("name,base_price")
    .eq("id", booking.data.service_id)
    .maybeSingle();

  const payment = await supabase
    .from("payments")
    .select("status,provider,amount_clp,currency,created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const env = getEnv();
  const total = payment.data?.amount_clp ?? service.data?.base_price ?? 0;
  const whenUtc = bookingLocalDateTime(booking.data.date, booking.data.time);
  const whenDateText = formatInTimeZone(whenUtc, TZ, "yyyy-MM-dd");
  const whenTimeText = formatInTimeZone(whenUtc, TZ, "HH:mm");

  const vehicleText = [
    booking.data.vehicle_make,
    booking.data.vehicle_model,
  ]
    .filter(Boolean)
    .join(" ");

  const subject = "✅ Servicio confirmado – Gestión Revisión Técnica";
  const html = `
    <div style="font-family: ui-sans-serif, system-ui; line-height:1.5; color:#0b1220">
      <p>Estimado/a ${booking.data.customer_name},</p>
      <p>Hemos recibido correctamente tu pago y tu solicitud de gestión de revisión técnica.</p>
      <p>📍 <b>Dirección de retiro:</b> ${booking.data.address}</p>
      <p>🚗 <b>Vehículo:</b> ${vehicleText || "—"}${booking.data.vehicle_plate ? ` – ${booking.data.vehicle_plate}` : ""}</p>
      <p>📅 <b>Fecha programada:</b> ${whenDateText} ${whenTimeText}</p>
      <p>Un operador se pondrá en contacto contigo el mismo día del servicio 15 minutos antes de llegar.</p>
      <p><b>🔎 Importante para el retiro:</b></p>
      <ul>
        <li>Permiso de circulación vigente</li>
        <li>SOAP vigente</li>
        <li>Padrón del vehículo</li>
        <li>Llaves disponibles</li>
      </ul>
      <p>El operador le informará que tomará 4 fotos (delantera, trasera y laterales) para dejar constancia del estado actual de su vehículo.</p>
      <p>Ante cualquier duda puedes responder este correo${
        env.TPRT_SUPPORT_WHATSAPP ? ` o escribirnos a WhatsApp ${env.TPRT_SUPPORT_WHATSAPP}` : ""
      }.</p>
      <p>Gracias por confiar en nosotros.</p>
      <p>Atentamente,<br/>Equipo GVRT Revisión Técnica</p>
      <hr />
      <p style="font-size:12px;color:#5b6777">Total: ${formatClp(total)} · ID: ${booking.data.id}</p>
    </div>
  `;

  await sendEmail({ to: booking.data.email, cc: "contacto@gvrt.cl", subject, html });
}

export async function sendOperationsNewServiceEmail(bookingId: string) {
  const env = getEnv();
  const opsList = [
    ...(env.OPERATIONS_EMAILS || "").split(","),
    ...(env.TPRT_SUPPORT_EMAIL ? [env.TPRT_SUPPORT_EMAIL] : []),
    ...(env.ADMIN_EMAILS || "").split(","),
    "contacto@gvrt.cl",
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  if (opsList.length === 0) throw new Error("operations_emails_not_configured");

  const supabase = getSupabaseAdmin();
  const booking = await supabase
    .from("bookings")
    .select("id,status,date,time,customer_name,email,phone,address,notes,vehicle_plate,vehicle_make,vehicle_model,vehicle_year")
    .eq("id", bookingId)
    .maybeSingle();
  if (booking.error || !booking.data) throw new Error("booking_not_found");

  const whenUtc = bookingLocalDateTime(booking.data.date, booking.data.time);
  const dateText = formatInTimeZone(whenUtc, TZ, "yyyy-MM-dd");
  const timeText = formatInTimeZone(whenUtc, TZ, "HH:mm");

  const vehicleText = [
    booking.data.vehicle_make,
    booking.data.vehicle_model,
    booking.data.vehicle_year ? String(booking.data.vehicle_year) : null,
  ]
    .filter(Boolean)
    .join(" ");

  const subject = "🚨 Nuevo servicio agendado";
  const html = `
    <div style="font-family: ui-sans-serif, system-ui; line-height:1.5; color:#0b1220">
      <p><b>Nuevo servicio confirmado:</b></p>
      <ul>
        <li><b>Cliente:</b> ${booking.data.customer_name}</li>
        <li><b>Teléfono:</b> ${booking.data.phone}</li>
        <li><b>Dirección:</b> ${booking.data.address}</li>
        <li><b>Patente:</b> ${booking.data.vehicle_plate ?? "—"}</li>
        <li><b>Fecha:</b> ${dateText}</li>
        <li><b>Hora solicitada:</b> ${timeText}</li>
        <li><b>Estado:</b> Pendiente asignación operador.</li>
      </ul>
      <p><b>Vehículo:</b> ${vehicleText || "—"}</p>
      <p><b>Email:</b> ${booking.data.email}</p>
      ${booking.data.notes ? `<p><b>Notas:</b> ${booking.data.notes}</p>` : ""}
      <p style="font-size:12px;color:#5b6777">Booking ID: ${booking.data.id}</p>
    </div>
  `;

  await sendEmail({ to: opsList, subject, html });
}

export async function sendBookingReminder24hEmail(bookingId: string, windowMinutes: number) {
  const supabase = getSupabaseAdmin();
  const booking = await supabase
    .from("bookings")
    .select("id,date,time,customer_name,email")
    .eq("id", bookingId)
    .maybeSingle();
  if (booking.error || !booking.data) throw new Error("booking_not_found");

  const startUtc = bookingLocalDateTime(booking.data.date, booking.data.time);
  const endUtc = new Date(startUtc.getTime() + windowMinutes * 60_000);
  const rangeText = `${formatInTimeZone(startUtc, TZ, "HH:mm")}–${formatInTimeZone(endUtc, TZ, "HH:mm")}`;

  const subject = "📅 Recordatorio servicio revisión técnica";
  const html = `
    <div style="font-family: ui-sans-serif, system-ui; line-height:1.5; color:#0b1220">
      <p>Estimado/a ${booking.data.customer_name},</p>
      <p>Te recordamos que mañana realizaremos el retiro de tu vehículo para la revisión técnica.</p>
      <p>El horario estimado es entre <b>${rangeText}</b>.</p>
      <p>Nuestro operador te contactará 15 minutos antes de llegar.</p>
      <p><b>Recuerda tener disponibles:</b></p>
      <ul>
        <li>Documentación</li>
        <li>Llaves</li>
        <li>Vehículo accesible</li>
      </ul>
      <p>Nos vemos pronto.</p>
      <p style="font-size:12px;color:#5b6777">ID: ${booking.data.id}</p>
    </div>
  `;

  await sendEmail({ to: booking.data.email, subject, html });
}
