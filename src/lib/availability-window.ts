import { formatInTimeZone } from "date-fns-tz";
import { SANTIAGO_TZ, getSantiagoTodayIso } from "@/lib/time";

export const DEFAULT_AGENDA_TIMES = ["07:30", "09:30", "11:30", "13:30", "15:30"] as const;
export const TEMP_SINGLE_OPERATOR_DATE_FROM = "2026-03-02";
export const TEMP_SINGLE_OPERATOR_DATE_TO = "2026-03-06";
export const TEMP_SINGLE_OPERATOR_TIMES = ["07:30", "09:30", "11:30", "13:30"] as const;
export const TEMP_SINGLE_OPERATOR_CAPACITY = 1;

export type AgendaReleaseMap = Map<string, string>;

function normalizeTimeToHHMM(time: string) {
  return time.slice(0, 5);
}

function buildDemand(remaining: number, capacity: number) {
  if (remaining <= 0) return "sold_out";
  if (capacity <= 2 && remaining === 1) return "high";
  if (remaining / capacity <= 0.25) return "high";
  if (remaining / capacity <= 0.5) return "medium";
  return "low";
}

export function isWithinTemporarySingleOperatorWindow(dateIso: string) {
  return dateIso >= TEMP_SINGLE_OPERATOR_DATE_FROM && dateIso <= TEMP_SINGLE_OPERATOR_DATE_TO;
}

export function getAgendaTimesForDate(dateIso: string) {
  return isWithinTemporarySingleOperatorWindow(dateIso) ? [...TEMP_SINGLE_OPERATOR_TIMES] : [...DEFAULT_AGENDA_TIMES];
}

export function isAllowedAgendaTime(dateIso: string, time: string) {
  return getAgendaTimesForDate(dateIso).some((candidate) => candidate === normalizeTimeToHHMM(time));
}

export function isPastAgendaTime(dateIso: string, time: string) {
  const todayIso = getSantiagoTodayIso();
  if (dateIso < todayIso) return true;
  if (dateIso > todayIso) return false;
  const nowTime = formatInTimeZone(new Date(), SANTIAGO_TZ, "HH:mm");
  return normalizeTimeToHHMM(time) <= nowTime;
}

export function applyTemporaryAvailabilityWindow<
  T extends {
    date: string;
    time: string;
    capacity: number;
    reserved: number;
    remaining: number;
    demand: string;
    available: boolean;
  },
>(slots: T[], releaseMap: AgendaReleaseMap = new Map()) {
  return slots
    .filter((slot) => isAllowedAgendaTime(slot.date, slot.time))
    .filter((slot) => !isPastAgendaTime(slot.date, slot.time))
    .filter((slot) => {
      if (!isWithinTemporarySingleOperatorWindow(slot.date)) return true;
      const releasedUntilTime = releaseMap.get(slot.date) ?? TEMP_SINGLE_OPERATOR_TIMES[0];
      return normalizeTimeToHHMM(slot.time) <= releasedUntilTime;
    })
    .map((slot) => {
      if (!isWithinTemporarySingleOperatorWindow(slot.date)) {
        return slot;
      }

      const capacity = TEMP_SINGLE_OPERATOR_CAPACITY;
      const reserved = Math.min(slot.reserved, capacity);
      const remaining = Math.max(capacity - reserved, 0);
      const available = remaining > 0;

      return {
        ...slot,
        capacity,
        reserved,
        remaining,
        available,
        demand: buildDemand(remaining, capacity),
      };
    });
}
