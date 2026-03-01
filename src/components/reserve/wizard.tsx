"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { apiJson, ApiError } from "@/lib/api";
import { addDaysIso, getSantiagoTodayIso, isoDateToLocalNoon, toIsoDate } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Clock, CreditCard, MapPin, ScanLine, Search, ShieldCheck } from "lucide-react";
import { QueueModal } from "./queue-modal";
import { UrgencyTimer } from "./urgency-timer";
import { Label } from "@/components/ui/label";
import { GVRT_TERMS_SECTIONS } from "@/lib/legal/terms";
import { isLikelyChilePlate, normalizePlate } from "@/lib/vehicle/plate";
import {
  DEMO_COUPON_CODE,
  applyDiscount,
  getCouponDiscountPercent,
  normalizeCouponCode,
} from "@/lib/pricing";

const CHECKOUT_PREFILL_KEY = "gvrt_checkout_prefill_v1";
const HOLD_STORAGE_KEY = "gvrt_hold_id_v1";

type Service = {
  id: string;
  name: string;
  description: string;
  base_price: number;
  duration_minutes: number;
};

type Commune = { id: string; name: string; region: string };

type Slot = {
  date: string;
  time: string;
  capacity: number;
  reserved: number;
  remaining: number;
  demand: "sold_out" | "high" | "medium" | "low";
  available: boolean;
};

type Step = "queue" | "service" | "commune" | "calendar" | "details";

const INITIAL_DRIVER_CAPACITY = 3;
const MARCH_AGENDA_TIMES = ["07:30", "09:30", "11:30", "13:30", "15:30"];

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getAgendaTimesForDate(dateIso: string) {
  const [y, m, d] = dateIso.split("-").map((value) => Number(value));
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  const dow = date.getUTCDay();
  if (dow >= 1 && dow <= 6) return MARCH_AGENDA_TIMES;
  return [];
}

function buildDemoSlotsForDate(dateIso: string): Slot[] {
  return getAgendaTimesForDate(dateIso).map((time) => ({
    date: dateIso,
    time: `${time}:00`,
    capacity: INITIAL_DRIVER_CAPACITY,
    reserved: 0,
    remaining: INITIAL_DRIVER_CAPACITY,
    demand: "low",
    available: true,
  }));
}

function normalizeSlotTime(time: string) {
  return time.slice(0, 5);
}

function alignSlotsToAgenda(dateIso: string, slots: Slot[]) {
  const agendaTimes = new Set(getAgendaTimesForDate(dateIso));
  return slots.filter((slot) => agendaTimes.has(normalizeSlotTime(slot.time)));
}

function isValidEmail(input: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export function ReserveWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("queue");
  const [service, setService] = React.useState<Service | null>(null);
  const [commune, setCommune] = React.useState<Commune | null>(null);
  const dateFrom = React.useMemo(() => getSantiagoTodayIso(), []);
  const dateTo = React.useMemo(() => addDaysIso(dateFrom, 14), [dateFrom]);
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => isoDateToLocalNoon(dateFrom));
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [termsModalOpen, setTermsModalOpen] = React.useState(false);
  const [termsChecked, setTermsChecked] = React.useState(false);
  const [pendingService, setPendingService] = React.useState<Service | null>(null);
  const [couponCode, setCouponCode] = React.useState("");
  const [communeQuery, setCommuneQuery] = React.useState("");



  // Form Data
  const [patent, setPatent] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [vehicleMake, setVehicleMake] = React.useState("");
  const [vehicleModel, setVehicleModel] = React.useState("");
  const [vehicleYear, setVehicleYear] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const lastLookupPlateRef = React.useRef("");

  const services = useQuery({
    queryKey: ["catalog", "services"],
    queryFn: () => apiJson<{ services: Service[] }>("/api/catalog/services"),
  });

  const serviceList = services.data?.services ?? [];
  const serviceGridClass =
    serviceList.length <= 1 ? "mx-auto grid w-full max-w-xl gap-6" : "grid gap-6 md:grid-cols-2 lg:grid-cols-3";

  const communes = useQuery({
    enabled: !!service,
    queryKey: ["catalog", "communes", service?.id],
    queryFn: () =>
      apiJson<{ communes: Commune[] }>(`/api/catalog/communes?serviceId=${encodeURIComponent(service!.id)}`),
  });

  const availability = useQuery({
    enabled: !!service && !!commune && step !== "queue",
    queryKey: ["availability", service?.id, commune?.id, dateFrom, dateTo],
    queryFn: () =>
      apiJson<{ slots: Slot[] }>(
        `/api/availability?serviceId=${encodeURIComponent(service!.id)}&communeId=${encodeURIComponent(
          commune!.id,
        )}&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      ),
    refetchInterval: 10_000,
  });

  const createHold = useMutation({
    mutationFn: (input: { date: string; time: string }) =>
      apiJson<{ holdId: string; expiresAt: string }>("/api/holds", {
        method: "POST",
        body: JSON.stringify({ serviceId: service!.id, communeId: commune!.id, ...input }),
      }),
    onSuccess: (data) => {
      const normalizedCoupon = normalizeCouponCode(couponCode);
      const normalizedPatent = normalizePlate(patent);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          CHECKOUT_PREFILL_KEY,
          JSON.stringify({
            customerName: customerName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            vehiclePlate: normalizedPatent,
            vehicleMake: vehicleMake.trim(),
            vehicleModel: vehicleModel.trim(),
            vehicleYear: vehicleYear.trim(),
            address: address.trim(),
            notes: notes.trim(),
            couponCode: normalizedCoupon ?? "",
            provider: "transbank_webpay",
          }),
        );
        window.localStorage.setItem(HOLD_STORAGE_KEY, data.holdId);
      }
      const nextUrl = new URL("/carrito", window.location.origin);
      nextUrl.searchParams.set("holdId", data.holdId);
      if (normalizedCoupon) nextUrl.searchParams.set("coupon", normalizedCoupon);
      router.push(nextUrl.pathname + "?" + nextUrl.searchParams.toString());
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : "hold_failed";
      if (code === "slot_full") toast.error("Ese cupo acaba de agotarse. Elige otra hora.");
      else if (code === "slot_not_available") toast.error("Ese horario no está disponible. Prueba otro.");
      else if (code === "not_in_coverage") toast.error("La comuna seleccionada quedó fuera de cobertura. Elige otra.");
      else if (code === "rate_limited") toast.error("Demasiados intentos. Espera 1 minuto y vuelve a intentar.");
      else toast.error("No pudimos bloquear el cupo. Intenta nuevamente.");
    },
  });

  const slotsByDate = React.useMemo(() => {
    const all = availability.data?.slots ?? [];
    const map = new Map<string, Slot[]>();
    for (const s of all) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    for (const [, arr] of map) arr.sort((a, b) => a.time.localeCompare(b.time));
    return map;
  }, [availability.data?.slots]);

  const selectedDateIso = React.useMemo(() => toIsoDate(selectedDate), [selectedDate]);
  const slotsForDay = React.useMemo(
    () => alignSlotsToAgenda(selectedDateIso, slotsByDate.get(selectedDateIso) ?? []),
    [selectedDateIso, slotsByDate],
  );
  const showClientDemoSlots = !availability.isLoading && slotsForDay.length === 0;
  const visibleSlots = React.useMemo(
    () => (showClientDemoSlots ? buildDemoSlotsForDate(selectedDateIso) : slotsForDay),
    [showClientDemoSlots, selectedDateIso, slotsForDay],
  );
  const availableDates = React.useMemo(
    () =>
      new Set(
        [...slotsByDate.entries()]
          .filter(([date, slots]) => alignSlotsToAgenda(date, slots).length > 0)
          .map(([date]) => date),
      ),
    [slotsByDate],
  );
  const agendaTimesForSelectedDate = React.useMemo(() => getAgendaTimesForDate(selectedDateIso), [selectedDateIso]);
  const normalizedCouponCode = React.useMemo(() => normalizeCouponCode(couponCode), [couponCode]);
  const discountPercent = React.useMemo(() => getCouponDiscountPercent(normalizedCouponCode), [normalizedCouponCode]);
  const discountPreview = React.useMemo(
    () => applyDiscount(service?.base_price ?? 85_000, discountPercent),
    [service?.base_price, discountPercent],
  );
  const plateTypographyClass =
    patent.length >= 8
      ? "text-4xl tracking-[0.12em]"
      : patent.length >= 7
        ? "text-5xl tracking-[0.16em]"
        : "text-6xl tracking-[0.22em]";

  const plateLookup = useMutation({
    mutationFn: async ({ plate }: { plate: string; force: boolean }) =>
      apiJson<{
        vehicle: { plate: string; make: string | null; model: string | null; year: number | null; source: string };
      }>("/api/vehicle/lookup", {
        method: "POST",
        body: JSON.stringify({ plate }),
      }),
    onSuccess: ({ vehicle }, vars) => {
      if (vehicle.plate && vehicle.plate !== patent) setPatent(vehicle.plate);
      if (vars.force) {
        setVehicleMake(vehicle.make ?? "");
        setVehicleModel(vehicle.model ?? "");
        setVehicleYear(vehicle.year ? String(vehicle.year) : "");
        if (vehicle.make || vehicle.model || vehicle.year) toast.success("Datos del vehículo cargados.");
        else toast.error("No encontramos datos para esa patente.");
        return;
      }
      if (vehicle.make && !vehicleMake) setVehicleMake(vehicle.make);
      if (vehicle.model && !vehicleModel) setVehicleModel(vehicle.model);
      if (vehicle.year && !vehicleYear) setVehicleYear(String(vehicle.year));
    },
    onError: () => toast.error("No pudimos consultar la patente."),
  });

  React.useEffect(() => {
    const normalized = normalizePlate(patent);
    if (normalized.length < 5 || !isLikelyChilePlate(normalized)) return;
    if (lastLookupPlateRef.current === normalized) return;
    const t = setTimeout(() => {
      lastLookupPlateRef.current = normalized;
      plateLookup.mutate({ plate: normalized, force: false });
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patent]);

  // Handler for Queue Completion
  const handleQueueComplete = () => {
    setStep("service");
  };

  const moveToCommuneStep = React.useCallback((selectedService: Service) => {
    setService(selectedService);
    setCommune(null);
    setCommuneQuery("");
    setSelectedSlot(null);
    setStep("commune");
  }, []);

  const handleServiceSelection = (selectedService: Service) => {
    if (termsAccepted) {
      moveToCommuneStep(selectedService);
      return;
    }
    setPendingService(selectedService);
    setTermsChecked(false);
    setTermsModalOpen(true);
  };

  const acceptTermsAndContinue = () => {
    if (!termsChecked || !pendingService) return;
    setTermsAccepted(true);
    setTermsModalOpen(false);
    moveToCommuneStep(pendingService);
  };

  const filteredCommunes = React.useMemo(() => {
    const communeOptions = communes.data?.communes ?? [];
    const query = communeQuery.trim().toLowerCase();
    if (!query) return communeOptions;
    return communeOptions.filter((item) => `${item.name} ${item.region}`.toLowerCase().includes(query));
  }, [communes.data?.communes, communeQuery]);

  const readPlateFromInput = () => {
    const normalized = normalizePlate(patent);
    if (normalized.length < 5) {
      toast.error("Ingresa primero la patente para consultarla.");
      return;
    }
    setPatent(normalized);
    plateLookup.mutate({ plate: normalized, force: true });
  };

  const handleConfirmAndPay = () => {
    if (!selectedSlot) return;
    const normalizedPatent = normalizePlate(patent);
    if (!isLikelyChilePlate(normalizedPatent)) {
      toast.error("Ingresa una patente válida.");
      return;
    }
    if (!customerName.trim() || customerName.trim().length < 2) {
      toast.error("Ingresa el nombre del cliente.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      toast.error("Ingresa un teléfono válido.");
      return;
    }
    if (!address.trim() || address.trim().length < 5) {
      toast.error("Ingresa la dirección de retiro.");
      return;
    }
    if (!isValidEmail(email)) {
      toast.error("Ingresa un email válido.");
      return;
    }
    if (!vehicleMake.trim() || !vehicleModel.trim()) {
      toast.error("Completa marca y modelo del vehículo.");
      return;
    }
    createHold.mutate({ date: selectedSlot.date, time: normalizeSlotTime(selectedSlot.time) });
  };

  if (step === "queue") {
    return <QueueModal onComplete={handleQueueComplete} />;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">

      {/* Stepper Header (Hidden in details step for FOMO focus or changed style) */}
      {step !== "details" && (
        <div className="flex items-center justify-center gap-4 text-sm font-medium text-muted-foreground mb-8">
          <div className={`flex items-center gap-2 ${step === 'service' ? 'text-primary' : ''}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${step === 'service' ? 'border-primary bg-primary/10' : 'border-gray-200'}`}>1</div>
            <span>Servicio</span>
          </div>
          <div className="h-0.5 w-8 bg-gray-200"></div>
          <div className={`flex items-center gap-2 ${step === 'commune' ? 'text-primary' : ''}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${step === 'commune' ? 'border-primary bg-primary/10' : 'border-gray-200'}`}>2</div>
            <span>Ubicación</span>
          </div>
          <div className="h-0.5 w-8 bg-gray-200"></div>
          <div className={`flex items-center gap-2 ${step === 'calendar' ? 'text-primary' : ''}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${step === 'calendar' ? 'border-primary bg-primary/10' : 'border-gray-200'}`}>3</div>
            <span>Agendar</span>
          </div>
          <div className="h-0.5 w-8 bg-gray-200"></div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full flex items-center justify-center border-2 border-gray-200">4</div>
            <span>Pago</span>
          </div>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {step === "service" && (
          <motion.div
            key="step-service"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={serviceGridClass}
          >
            {services.isLoading && !serviceList.length ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)
            ) : (
              serviceList.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleServiceSelection(s)}
                  className="cursor-pointer group relative overflow-hidden rounded-xl border-2 border-gray-100 bg-white p-6 shadow-sm hover:border-primary hover:shadow-lg transition-all"
                >
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-gradient-to-br from-primary/20 via-sky-400/10 to-transparent blur-2xl" />
                    <div className="absolute right-4 top-4 rounded-lg border border-primary/20 bg-white/80 px-2 py-1 text-[10px] font-bold tracking-[0.2em] text-primary">
                      GVRT
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{s.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">{s.description}</p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                    <span className="text-2xl font-black text-primary">{formatClp(s.base_price)}</span>
                    <Button size="sm" className="rounded-full">Seleccionar</Button>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {step === "commune" && (
          <motion.div
            key="step-commune"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mx-auto grid max-w-4xl gap-6 py-4 lg:grid-cols-[minmax(0,1.35fr)_300px]"
          >
            <div className="space-y-6">
              <div className="text-center lg:text-left space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">¿Dónde retiramos tu auto?</h2>
                <p className="text-muted-foreground">Busca tu comuna, selecciónala y continúa cuando quede correcta.</p>
              </div>

              <Card className="border-gray-200 bg-white shadow-sm">
                <CardContent className="space-y-5 p-6">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Busca tu comuna</Label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={communeQuery}
                        onChange={(e) => {
                          const nextQuery = e.target.value;
                          setCommuneQuery(nextQuery);
                          if (commune && commune.name.toLowerCase() !== nextQuery.trim().toLowerCase()) {
                            setCommune(null);
                          }
                        }}
                        placeholder="Escribe una comuna..."
                        className="h-12 rounded-2xl border-gray-200 bg-gray-50 pl-11"
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Ya no avanzamos automáticamente: primero eliges la comuna y luego confirmas.
                    </p>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50/70 p-2">
                    {communes.isLoading ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                        Cargando comunas disponibles...
                      </div>
                    ) : filteredCommunes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                        No encontramos comunas con ese criterio.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredCommunes.map((item) => {
                          const isSelected = commune?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setCommune(item);
                                setCommuneQuery(item.name);
                              }}
                              className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : "border-transparent bg-white hover:border-primary/30 hover:bg-primary/[0.03]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-gray-900">{item.name}</div>
                                  <div className="text-sm text-gray-500">{item.region}</div>
                                </div>
                                {isSelected ? (
                                  <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                                    Seleccionada
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <Button
                      variant="ghost"
                      onClick={() => setStep("service")}
                      className="w-full text-gray-500 hover:text-gray-700 sm:w-auto"
                    >
                      Volver
                    </Button>
                    <Button
                      onClick={() => commune && setStep("calendar")}
                      disabled={!commune}
                      className="w-full sm:flex-1"
                    >
                      {commune ? `Continuar con ${commune.name}` : "Selecciona una comuna para continuar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-blue-100 bg-blue-50/80 shadow-none">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-blue-950">Cobertura comercial</p>
                    <p className="text-sm leading-6 text-blue-900/80">
                      Retiramos el vehículo en la dirección que indiques más adelante y coordinamos el traslado dentro de Santiago.
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-white/70 p-4 text-sm text-blue-900">
                  <p className="font-semibold">Paso siguiente</p>
                  <p className="mt-1 leading-6">
                    Verás los bloques de agenda disponibles para la comuna elegida, en franjas de 2 horas desde las 07:30.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === "calendar" && (
          <motion.div
            key="step-calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-12 rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{commune?.name}</p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Agenda tu retiro</h2>
                  <p className="text-sm text-slate-600">
                    Bloques de 2 horas desde las 07:30. Capacidad inicial planificada: {INITIAL_DRIVER_CAPACITY} choferes por bloque.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {agendaTimesForSelectedDate.map((time) => (
                    <span
                      key={time}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Calendar Column */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Selecciona Fecha
                </h3>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  disabled={(d) => {
                    const iso = toIsoDate(d);
                    if (iso < dateFrom || iso > dateTo) return true;
                    if (availableDates.size === 0) return false;
                    return !availableDates.has(iso);
                  }}
                  className="rounded-md border mx-auto"
                />
              </div>
            </div>

            {/* Slots Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">Bloques Disponibles</h3>
                {showClientDemoSlots ? (
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                    ● Horarios demo
                  </span>
                ) : (
                  <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full animate-pulse">
                    ● En tiempo real
                  </span>
                )}
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900">
                Pocos cupos. Cada horario tiene {INITIAL_DRIVER_CAPACITY} cupos y abajo puedes ver cuántos quedan disponibles.
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availability.isLoading ? (
                  <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    Cargando horarios disponibles...
                  </div>
                ) : visibleSlots.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No hay horarios para este día.
                  </div>
                ) : (
                  visibleSlots.map((s) => (
                    <button
                      key={s.time}
                      disabled={!s.available}
                      onClick={() => {
                        setSelectedSlot(s);
                        setStep("details");
                      }}
                      className={`
                                    relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all
                                    ${!s.available ? 'opacity-50 grayscale cursor-not-allowed border-gray-100 bg-gray-50' : 'border-gray-200 bg-white hover:border-primary hover:shadow-md cursor-pointer'}
                                `}
                    >
                      <span className="text-lg font-bold text-gray-800">{normalizeSlotTime(s.time)}</span>
                      <span className="mt-1 text-[11px] font-medium text-gray-500">
                        {s.available ? `${s.remaining} cupos disponibles` : "Sin cupos"}
                      </span>
                    </button>
                  ))
                )}
              </div>

              <Button variant="ghost" onClick={() => setStep("commune")} className="px-0 text-gray-500 hover:text-gray-700">
                Cambiar comuna
              </Button>
            </div>
          </motion.div>
        )}

        {step === "details" && selectedSlot && (
          <motion.div
            key="step-details"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto"
          >
            {/* Urgency Header */}
            <div className="mb-6 rounded-xl overflow-hidden shadow-lg border border-red-100">
              <UrgencyTimer />
            </div>

            <div className="grid md:grid-cols-12 gap-8">
              {/* Formulario */}
              <div className="md:col-span-7 space-y-6">
                <Card className="border-0 shadow-md">
                  <CardHeader>
                    <CardTitle>Datos del Vehículo</CardTitle>
                    <CardDescription>Completa aquí todo el formulario. En checkout solo confirmas y pagas.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Patente Visual */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-xs uppercase font-bold tracking-wider text-gray-500">Patente Vehículo *</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={readPlateFromInput}
                          disabled={plateLookup.isPending}
                        >
                          <ScanLine className="h-4 w-4" />
                          {plateLookup.isPending ? "Consultando..." : "Leer mi patente"}
                        </Button>
                      </div>
                      <div className="relative">
                        <div className="border-4 border-black rounded-lg p-1 bg-white shadow-sm w-full max-w-[560px]">
                          <div className="border border-gray-200 rounded flex items-center relative h-28 w-full px-6 bg-white">
                            {/* Simulated Chile Plate Design */}
                            <div className="absolute left-3 top-3 bottom-3 w-10 flex flex-col justify-between items-center opacity-30">
                              <span className="text-[9px] font-bold">CHILE</span>
                            </div>
                            <Input
                              value={patent}
                              onChange={(e) => setPatent(normalizePlate(e.target.value))}
                              maxLength={8}
                              className={`border-0 text-center font-mono font-black outline-none shadow-none focus-visible:ring-0 uppercase placeholder:opacity-20 h-full w-full ${plateTypographyClass}`}
                              placeholder="ABCD12"
                            />
                          </div>
                          <div className="text-center text-xs font-bold tracking-[0.25em] mt-1">CHILE</div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Ingresa tu patente sin guiones</p>
                        {plateLookup.isPending ? (
                          <p className="text-xs text-primary mt-1">Buscando automáticamente marca, modelo y año…</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Nombre completo *</Label>
                      <Input
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Nombre y apellido"
                        className="h-12 bg-gray-50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Teléfono *</Label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+56 9 1234 5678"
                        className="h-12 bg-gray-50"
                        inputMode="tel"
                      />
                    </div>

                    {/* Comuna Solicitante */}
                    <div className="space-y-2">
                      <Label>Comuna solicitante *</Label>
                      <Input value={commune!.name} disabled className="bg-gray-100 font-bold text-gray-600" />
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <Label>Dirección *</Label>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Calle, Número, Depto"
                        className="h-12 bg-gray-50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="correo@ejemplo.cl"
                        className="h-12 bg-gray-50"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Marca *</Label>
                        <Input
                          value={vehicleMake}
                          onChange={(e) => setVehicleMake(e.target.value)}
                          placeholder="Toyota"
                          className="h-12 bg-gray-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Modelo *</Label>
                        <Input
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          placeholder="Yaris"
                          className="h-12 bg-gray-50"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Año (opcional)</Label>
                      <Input
                        value={vehicleYear}
                        onChange={(e) => setVehicleYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                        placeholder="2018"
                        className="h-12 bg-gray-50"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notas (opcional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Referencia para retiro, disponibilidad, etc."
                        className="bg-gray-50 min-h-24"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Resumen de Pago */}
              <div className="md:col-span-5 space-y-6">
                <Card className="bg-gray-50 border-gray-200 shadow-inner">
                  <CardHeader className="pb-3 border-b border-gray-200">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-green-600" /> Resumen de Reserva
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex justify-between items-start text-sm">
                      <div className="space-y-1">
                        <p className="font-bold text-gray-800">{service?.name}</p>
                        <p className="text-xs text-gray-500">{commune?.name} • {selectedDateIso} • {normalizeSlotTime(selectedSlot.time)}</p>
                      </div>
                      <span className="font-semibold">{formatClp(service!.base_price)}</span>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="demo-coupon">Código de descuento (opcional)</Label>
                      <Input
                        id="demo-coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder={`Ej: ${DEMO_COUPON_CODE}`}
                      />
                      <p className="text-xs text-gray-500">
                        Si tienes un cupón vigente, ingrésalo aquí antes de confirmar el pago.
                      </p>
                    </div>

                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>Descuento</span>
                      <span>{discountPercent > 0 ? `- ${formatClp(discountPreview.discountAmountClp)}` : formatClp(0)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                      <span className="font-bold text-lg">Total</span>
                      <span className="font-black text-2xl text-primary">{formatClp(discountPreview.finalAmountClp)}</span>
                    </div>

                    <Button
                      className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg mt-4"
                      onClick={handleConfirmAndPay}
                      disabled={createHold.isPending}
                    >
                      {createHold.isPending ? "Procesando..." : "Confirmar y Pagar"}
                    </Button>
                  </CardContent>
                  <div className="px-6 pb-6 pt-2 text-center">
                    <p className="text-xs text-gray-400 mb-2">Pago seguro con Webpay</p>
                    <div className="flex justify-center items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
                      <CreditCard className="h-6 w-6" />
                      <span className="font-semibold tracking-tight">Webpay</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {termsModalOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Aceptación de Términos y Condiciones</h3>
              <p className="text-sm text-gray-600">GVRT Revisión Técnica</p>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[55vh] overflow-y-auto">
              <p className="text-sm text-gray-700 leading-6">
                Para continuar con la reserva debes aceptar los Términos y Condiciones del servicio.
              </p>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900">{GVRT_TERMS_SECTIONS[0]?.title}</p>
                <p className="text-sm text-gray-700 leading-6">{GVRT_TERMS_SECTIONS[0]?.paragraphs[0]}</p>
                <p className="text-sm text-gray-700 leading-6">{GVRT_TERMS_SECTIONS[0]?.paragraphs[1]}</p>
              </div>
              <div className="text-sm text-gray-700 space-y-2">
                <p>Puedes revisar el texto completo aquí:</p>
                <Link href="/terminos" target="_blank" className="text-primary font-semibold underline underline-offset-2">
                  Ver Términos y Condiciones completos
                </Link>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 bg-white">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(e) => setTermsChecked(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm text-gray-700">
                  Declaro haber leído y acepto los Términos y Condiciones de GVRT Revisión Técnica.
                </span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setTermsModalOpen(false)}>Cancelar</Button>
              <Button onClick={acceptTermsAndContinue} disabled={!termsChecked}>Aceptar y continuar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
