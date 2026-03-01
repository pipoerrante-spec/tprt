"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { addDaysIso, getSantiagoTodayIso, isoDateToLocalNoon, toIsoDate } from "@/lib/time";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Service = { id: string; name: string };
type Commune = { id: string; name: string; region: string };
type Slot = {
  date: string;
  time: string;
  remaining: number;
  available: boolean;
};

function formatSlotTime(time: string) {
  return time.slice(0, 5);
}

export function BookingAvailabilityCalendar() {
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => isoDateToLocalNoon(getSantiagoTodayIso()));
  const dateFrom = React.useMemo(() => getSantiagoTodayIso(), []);
  const dateTo = React.useMemo(() => addDaysIso(dateFrom, 14), [dateFrom]);

  const services = useQuery({
    queryKey: ["calendar-booking", "services"],
    queryFn: () => apiJson<{ services: Service[] }>("/api/catalog/services"),
  });

  const service = services.data?.services?.[0] ?? null;

  const communes = useQuery({
    enabled: !!service,
    queryKey: ["calendar-booking", "communes", service?.id],
    queryFn: () =>
      apiJson<{ communes: Commune[] }>(`/api/catalog/communes?serviceId=${encodeURIComponent(service!.id)}`),
  });

  const commune = React.useMemo(
    () => communes.data?.communes?.find((item) => item.name === "La Reina") ?? communes.data?.communes?.[0] ?? null,
    [communes.data?.communes],
  );

  const availability = useQuery({
    enabled: !!service && !!commune,
    queryKey: ["calendar-booking", "availability", service?.id, commune?.id, dateFrom, dateTo],
    queryFn: () =>
      apiJson<{ slots: Slot[] }>(
        `/api/availability?serviceId=${encodeURIComponent(service!.id)}&communeId=${encodeURIComponent(
          commune!.id,
        )}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      ),
    refetchOnWindowFocus: false,
  });

  const selectedDateIso = React.useMemo(() => toIsoDate(selectedDate), [selectedDate]);
  const availableDates = React.useMemo(
    () =>
      new Set(
        (availability.data?.slots ?? [])
          .filter((slot) => slot.available && slot.remaining > 0)
          .map((slot) => slot.date),
      ),
    [availability.data?.slots],
  );

  const slotsForDay = React.useMemo(
    () =>
      (availability.data?.slots ?? [])
        .filter((slot) => slot.date === selectedDateIso && slot.available && slot.remaining > 0)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [availability.data?.slots, selectedDateIso],
  );

  const nextAvailableDate = React.useMemo(() => {
    const sortedDates = [...availableDates].sort();
    return sortedDates[0] ?? null;
  }, [availableDates]);

  React.useEffect(() => {
    if (!nextAvailableDate) return;
    if (availableDates.has(selectedDateIso)) return;
    setSelectedDate(isoDateToLocalNoon(nextAvailableDate));
  }, [availableDates, nextAvailableDate, selectedDateIso]);

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="inline-flex w-fit rounded-full bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-red-600">
          Cupos limitados
        </div>
        <CardTitle className="text-lg text-primary">Próximas fechas disponibles</CardTitle>
        <p className="text-sm text-gray-600">
          Mostramos disponibilidad real para {commune?.name ?? "la comuna seleccionada"} con bloques desde las 07:30.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {services.isLoading || communes.isLoading || availability.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[320px] rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-gray-200 bg-white">
              <Calendar
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => !availableDates.has(toIsoDate(date))}
              />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {slotsForDay.length > 0 ? `Horarios del ${selectedDateIso}` : "No hay horarios para ese día"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {nextAvailableDate
                      ? `Próxima fecha con cupos: ${nextAvailableDate}`
                      : "Estamos actualizando la agenda en este momento."}
                  </div>
                </div>
                <Button asChild className="bg-destructive hover:bg-destructive/90">
                  <Link href="/reservar">Reservar</Link>
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {slotsForDay.length > 0 ? (
                  slotsForDay.map((slot) => (
                    <div
                      key={`${slot.date}-${slot.time}`}
                      className="rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                    >
                      {formatSlotTime(slot.time)} · {slot.remaining} cupos
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">
                    Selecciona una fecha habilitada para ver los horarios disponibles.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
