import { formatInTimeZone } from "date-fns-tz";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_AGENDA_TIMES, getAgendaTimesForDate, isWithinTemporarySingleOperatorWindow } from "@/lib/availability-window";
import { SANTIAGO_TZ, getSantiagoTodayIso } from "@/lib/time";

const OPS_RELEASE_PROVIDER = "ops_agenda_release";

type ReleasePayload = {
  date?: string | null;
  released_until_time?: string | null;
  completed_booking_id?: string | null;
  released_by?: string | null;
};

export type ReleaseState = {
  date: string;
  releasedUntilTime: string;
  completedBookingId: string | null;
};

function normalizeTimeToHHMM(time: string) {
  return time.slice(0, 5);
}

function compareTimes(a: string, b: string) {
  return normalizeTimeToHHMM(a).localeCompare(normalizeTimeToHHMM(b));
}

function defaultReleasedUntilTime(dateIso: string) {
  return getAgendaTimesForDate(dateIso)[0] ?? DEFAULT_AGENDA_TIMES[0];
}

export function getReleasedUntilTime(dateIso: string, releaseState?: ReleaseState | null) {
  if (!isWithinTemporarySingleOperatorWindow(dateIso)) {
    const times = getAgendaTimesForDate(dateIso);
    return times[times.length - 1] ?? defaultReleasedUntilTime(dateIso);
  }
  return releaseState?.releasedUntilTime ?? defaultReleasedUntilTime(dateIso);
}

export function isSlotReleased(dateIso: string, time: string, releaseState?: ReleaseState | null) {
  return compareTimes(time, getReleasedUntilTime(dateIso, releaseState)) <= 0;
}

export function getNextAgendaTime(dateIso: string, time: string) {
  const times = getAgendaTimesForDate(dateIso);
  const index = times.findIndex((slot) => slot === normalizeTimeToHHMM(time));
  return index >= 0 && index < times.length - 1 ? times[index + 1] : null;
}

export function isPastAgendaSlot(dateIso: string, time: string) {
  const todayIso = getSantiagoTodayIso();
  if (dateIso < todayIso) return true;
  if (dateIso > todayIso) return false;
  const nowTime = formatInTimeZone(new Date(), SANTIAGO_TZ, "HH:mm");
  return compareTimes(time, nowTime) <= 0;
}

export async function getAgendaReleaseStateMap(dates: string[]) {
  const uniqueDates = [...new Set(dates)].filter(isWithinTemporarySingleOperatorWindow);
  const stateMap = new Map<string, ReleaseState>();
  if (uniqueDates.length === 0) return stateMap;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("webhooks_log")
    .select("id,provider,payload_json,created_at")
    .eq("provider", OPS_RELEASE_PROVIDER)
    .order("created_at", { ascending: false });

  if (error || !data) return stateMap;

  for (const row of data) {
    const payload = (row.payload_json ?? {}) as ReleasePayload;
    const date = payload.date ?? null;
    const releasedUntilTime = payload.released_until_time ? normalizeTimeToHHMM(payload.released_until_time) : null;
    if (!date || !releasedUntilTime || !uniqueDates.includes(date) || stateMap.has(date)) continue;
    stateMap.set(date, {
      date,
      releasedUntilTime,
      completedBookingId: payload.completed_booking_id ?? null,
    });
  }

  return stateMap;
}

export async function releaseNextAgendaSlot(input: {
  bookingId: string;
  date: string;
  time: string;
  releasedBy: string;
}) {
  const nextTime = getNextAgendaTime(input.date, input.time);
  if (!nextTime) {
    return { releasedUntilTime: normalizeTimeToHHMM(input.time), nextTime: null };
  }

  const supabase = getSupabaseAdmin();
  const currentState = await getAgendaReleaseStateMap([input.date]);
  const currentUntil = getReleasedUntilTime(input.date, currentState.get(input.date));
  const releasedUntilTime = compareTimes(nextTime, currentUntil) > 0 ? nextTime : currentUntil;

  const insert = await supabase.from("webhooks_log").insert({
    provider: OPS_RELEASE_PROVIDER,
    processed: true,
    payload_json: {
      date: input.date,
      released_until_time: releasedUntilTime,
      completed_booking_id: input.bookingId,
      released_by: input.releasedBy,
      event: "release_next_slot",
    },
  });

  if (insert.error) {
    throw new Error("ops_release_save_failed");
  }

  return { releasedUntilTime, nextTime };
}

export async function getOperationsBookings() {
  const supabase = getSupabaseAdmin();

  const bookingsResult = await supabase
    .from("bookings")
    .select(
      "id,status,date,time,customer_name,email,phone,address,notes,vehicle_plate,vehicle_make,vehicle_model,vehicle_year,commune_id,service_id,created_at",
    )
    .in("status", ["confirmed", "completed"])
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (bookingsResult.error) {
    throw new Error("ops_bookings_unavailable");
  }

  const bookings = bookingsResult.data ?? [];
  const bookingIds = bookings.map((booking) => booking.id);
  const communeIds = [...new Set(bookings.map((booking) => booking.commune_id))];
  const serviceIds = [...new Set(bookings.map((booking) => booking.service_id))];

  const [paymentsResult, communesResult, servicesResult, releaseStateMap] = await Promise.all([
    bookingIds.length
      ? supabase
          .from("payments")
          .select(
            "id,booking_id,status,provider,amount_clp,currency,created_at,authorization_code,card_last4,transbank_buy_order,transbank_transaction_date",
          )
          .in("booking_id", bookingIds)
          .eq("status", "paid")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    communeIds.length
      ? supabase.from("communes").select("id,name,region").in("id", communeIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length
      ? supabase.from("services").select("id,name").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    getAgendaReleaseStateMap(bookings.map((booking) => booking.date)),
  ]);

  if (paymentsResult.error || communesResult.error || servicesResult.error) {
    throw new Error("ops_related_data_unavailable");
  }

  const paymentMap = new Map<string, (typeof paymentsResult.data)[number]>();
  for (const payment of paymentsResult.data ?? []) {
    if (!paymentMap.has(payment.booking_id)) paymentMap.set(payment.booking_id, payment);
  }

  const communeMap = new Map((communesResult.data ?? []).map((commune) => [commune.id, commune]));
  const serviceMap = new Map((servicesResult.data ?? []).map((service) => [service.id, service]));

  return bookings
    .filter((booking) => paymentMap.has(booking.id))
    .map((booking) => {
      const releaseState = releaseStateMap.get(booking.date) ?? null;
      const nextTime = getNextAgendaTime(booking.date, booking.time);
      return {
        booking,
        payment: paymentMap.get(booking.id)!,
        commune: communeMap.get(booking.commune_id) ?? null,
        service: serviceMap.get(booking.service_id) ?? null,
        releaseState,
        nextTime,
        canComplete: booking.status !== "completed",
        canReleaseNext:
          isWithinTemporarySingleOperatorWindow(booking.date) &&
          booking.status !== "completed" &&
          nextTime !== null,
      };
    });
}
