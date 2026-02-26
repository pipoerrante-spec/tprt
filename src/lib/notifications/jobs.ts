import { getEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { appendBookingToPlanilla } from "@/lib/notifications/planilla";
import {
  sendBookingConfirmationEmail,
  sendBookingReminder24hEmail,
  sendOperationsNewServiceEmail,
} from "@/lib/notifications/email";
import { fromZonedTime } from "date-fns-tz";

const TZ = "America/Santiago";

type NotificationJobRow = {
  id: string;
  booking_id: string;
  kind: string;
  channel: string;
  status: "pending" | "processing" | "sent" | "failed";
  send_at: string;
  attempts: number;
  last_error: string | null;
};

function bookingServiceDateToUtc(date: string, time: string) {
  const hhmm = time.length >= 5 ? time.slice(0, 5) : time;
  return fromZonedTime(new Date(`${date}T${hhmm}:00`), TZ);
}

export async function enqueueBookingPaidJobs(bookingId: string) {
  const supabase = getSupabaseAdmin();

  const booking = await supabase.from("bookings").select("id,date,time").eq("id", bookingId).maybeSingle();
  if (booking.error || !booking.data) throw new Error("booking_not_found");

  const serviceAtUtc = bookingServiceDateToUtc(booking.data.date, booking.data.time);
  const reminderAtUtc = new Date(serviceAtUtc.getTime() - 24 * 60 * 60_000);
  const now = new Date();
  const sendAt = reminderAtUtc.getTime() < now.getTime() ? new Date(now.getTime() + 60_000) : reminderAtUtc;

  const rows: Array<{ booking_id: string; kind: string; channel: string; send_at: string }> = [
    { booking_id: bookingId, kind: "customer_confirmation_email", channel: "email", send_at: now.toISOString() },
    { booking_id: bookingId, kind: "ops_new_service_email", channel: "email", send_at: now.toISOString() },
    { booking_id: bookingId, kind: "customer_reminder_24h_email", channel: "email", send_at: sendAt.toISOString() },
    { booking_id: bookingId, kind: "planilla_append", channel: "webhook", send_at: now.toISOString() },
  ];

  const upsert = await supabase.from("notification_jobs").upsert(rows, { onConflict: "booking_id,kind" });
  if (upsert.error) throw new Error("notification_jobs_upsert_failed");
}

async function runJob(job: NotificationJobRow) {
  const env = getEnv();

  switch (job.kind) {
    case "customer_confirmation_email":
      await sendBookingConfirmationEmail(job.booking_id);
      return;
    case "ops_new_service_email":
      await sendOperationsNewServiceEmail(job.booking_id);
      return;
    case "customer_reminder_24h_email":
      await sendBookingReminder24hEmail(job.booking_id, env.TPRT_REMINDER_WINDOW_MINUTES);
      return;
    case "planilla_append":
      await appendBookingToPlanilla(job.booking_id);
      return;
    default:
      throw new Error(`unknown_job_kind:${job.kind}`);
  }
}

export async function processDueNotificationJobs({ limit = 25 }: { limit?: number } = {}) {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  const due = await supabase
    .from("notification_jobs")
    .select("id,booking_id,kind,channel,status,send_at,attempts,last_error")
    .eq("status", "pending")
    .lte("send_at", nowIso)
    .order("send_at", { ascending: true })
    .limit(limit);

  if (due.error) throw new Error("notification_jobs_select_failed");

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const job of due.data ?? []) {
    processed += 1;

    const claim = await supabase
      .from("notification_jobs")
      .update({ status: "processing" })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claim.error || !claim.data) continue;

    try {
      await runJob(job as NotificationJobRow);
      sent += 1;
      await supabase
        .from("notification_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
    } catch (e) {
      const nextAttempts = (job.attempts ?? 0) + 1;
      const lastError = e instanceof Error ? e.message : "job_failed";
      const nextStatus = nextAttempts >= 5 ? "failed" : "pending";
      if (nextStatus === "failed") failed += 1;
      await supabase
        .from("notification_jobs")
        .update({ status: nextStatus, attempts: nextAttempts, last_error: lastError })
        .eq("id", job.id);
    }
  }

  return { processed, sent, failed };
}
