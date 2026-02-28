export type RevisionCalendarRow = {
  month: string;
  auto: string;
  taxi: string;
};

export const REVISION_CALENDAR: RevisionCalendarRow[] = [
  { month: "Enero", auto: "9", taxi: "9-0" },
  { month: "Febrero", auto: "0", taxi: "1-2" },
  { month: "Marzo", auto: "-", taxi: "3-4" },
  { month: "Abril", auto: "1", taxi: "5-6" },
  { month: "Mayo", auto: "2", taxi: "7-8" },
  { month: "Junio", auto: "3", taxi: "9-0" },
  { month: "Julio", auto: "4", taxi: "1-2" },
  { month: "Agosto", auto: "5", taxi: "3-4" },
  { month: "Septiembre", auto: "6", taxi: "5-6" },
  { month: "Octubre", auto: "7", taxi: "7-8" },
  { month: "Noviembre", auto: "8", taxi: "-" },
  { month: "Diciembre", auto: "-", taxi: "-" },
];

export function getChileMonthIndex(date: Date = new Date()): number {
  const monthNumber = Number(
    new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      timeZone: "America/Santiago",
    }).format(date),
  );

  return Math.min(11, Math.max(0, monthNumber - 1));
}

export function getCurrentRevisionCalendar(date: Date = new Date()): RevisionCalendarRow {
  return REVISION_CALENDAR[getChileMonthIndex(date)];
}
