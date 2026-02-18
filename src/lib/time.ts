import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const SANTIAGO_TZ = "America/Santiago";

export function getSantiagoTodayIso() {
  return formatInTimeZone(new Date(), SANTIAGO_TZ, "yyyy-MM-dd");
}

export function isoDateToLocalNoon(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map((x) => Number(x));
  return new Date(y!, (m! - 1)!, d!, 12, 0, 0, 0);
}

export function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function addDaysIso(isoDate: string, days: number) {
  return toIsoDate(addDays(isoDateToLocalNoon(isoDate), days));
}

