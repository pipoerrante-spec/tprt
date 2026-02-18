"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { apiJson, ApiError } from "@/lib/api";
import { addDaysIso, getSantiagoTodayIso, isoDateToLocalNoon, SANTIAGO_TZ, toIsoDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ChevronRight, Clock, MapPin, Sparkles, AlertCircle, CreditCard, ShieldCheck } from "lucide-react";
import { QueueModal } from "./queue-modal";
import { UrgencyTimer } from "./urgency-timer";
import { Label } from "@/components/ui/label";

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

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function demandBadge(demand: Slot["demand"]) {
  if (demand === "high") return { label: "Alta demanda", variant: "warning" as BadgeVariant };
  if (demand === "medium") return { label: "Demanda media", variant: "info" as BadgeVariant };
  if (demand === "sold_out") return { label: "Agotado", variant: "danger" as BadgeVariant };
  return { label: "Disponible", variant: "success" as BadgeVariant };
}

export function ReserveWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("queue");
  const [service, setService] = React.useState<Service | null>(null);
  const [commune, setCommune] = React.useState<Commune | null>(null);
  const [communeQuery, setCommuneQuery] = React.useState("");
  const dateFrom = React.useMemo(() => getSantiagoTodayIso(), []);
  const dateTo = React.useMemo(() => addDaysIso(dateFrom, 14), [dateFrom]);
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => isoDateToLocalNoon(dateFrom));
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null);



  // Form Data
  const [patent, setPatent] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [email, setEmail] = React.useState("");

  const services = useQuery({
    queryKey: ["catalog", "services"],
    queryFn: () => apiJson<{ services: Service[] }>("/api/catalog/services"),
  });

  const SANTIAGO_COMMUNES = [
    "Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba",
    "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina",
    "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa",
    "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal",
    "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Santiago", "Vitacura"
  ];

  // Fallback data in case API fails or is empty during dev
  const fallbackServices: Service[] = [
    {
      id: "srv_premium_tprt",
      name: "Revisión Técnica Inteligente",
      description: "Gestión completa: Retiro, Revisión, Aprobación y Entrega a domicilio.",
      base_price: 114260,
      duration_minutes: 60
    }
  ];

  const serviceList = (services.data?.services && services.data.services.length > 0)
    ? services.data.services
    : fallbackServices;

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
      // In a real app we'd save the form data too, but here we just redirect to simulate payment
      router.push(`/carrito?holdId=${encodeURIComponent(data.holdId)}`);
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : "hold_failed";
      if (code === "slot_full") toast.error("Ese cupo acaba de agotarse. Elige otra hora.");
      else if (code === "slot_not_available") toast.error("Ese horario no está disponible. Prueba otro.");
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
  const slotsForDay = slotsByDate.get(selectedDateIso) ?? [];
  const availableDates = React.useMemo(() => new Set([...slotsByDate.keys()]), [slotsByDate]);

  const filteredCommunes = React.useMemo(() => {
    const list = communes.data?.communes ?? [];
    const q = communeQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => `${c.name} ${c.region}`.toLowerCase().includes(q));
  }, [communes.data?.communes, communeQuery]);

  // Handler for Queue Completion
  const handleQueueComplete = () => {
    setStep("service");
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
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {services.isLoading && !serviceList.length ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)
            ) : (
              serviceList.map((s) => (
                <div
                  key={s.id}
                  onClick={() => { setService(s); setCommune(null); setStep("commune"); }}
                  className="cursor-pointer group relative overflow-hidden rounded-xl border-2 border-gray-100 bg-white p-6 shadow-sm hover:border-primary hover:shadow-lg transition-all"
                >
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Sparkles className="h-24 w-24 text-primary" />
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
            className="max-w-md mx-auto space-y-8 py-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">¿Dónde retiramos tu auto?</h2>
              <p className="text-muted-foreground">Cobertura exclusiva en Santiago.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Selecciona tu comuna</Label>
                <Select onValueChange={(val) => {
                  setCommune({ id: val.toLowerCase(), name: val, region: "Metropolitana" });
                  setStep("calendar");
                }}>
                  <SelectTrigger className="h-14 text-lg bg-white border-2 border-gray-200 focus:ring-0 focus:border-primary">
                    <SelectValue placeholder="Buscar comuna..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {SANTIAGO_COMMUNES.map((c) => (
                      <SelectItem key={c} value={c} className="text-base py-3 cursor-pointer">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
                <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 leading-relaxed">
                  Nuestros <span className="font-bold">Drivers certificados</span> retirarán tu vehículo en la dirección que indiques en el siguiente paso.
                </p>
              </div>
            </div>

            <Button variant="ghost" onClick={() => setStep("service")} className="w-full text-gray-400 hover:text-gray-600">Volver</Button>
          </motion.div>
        )}

        {step === "calendar" && (
          <motion.div
            key="step-calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid lg:grid-cols-12 gap-8"
          >
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
                    return iso < dateFrom || iso > dateTo || !availableDates.has(iso);
                  }}
                  className="rounded-md border mx-auto"
                />
              </div>
            </div>

            {/* Slots Column */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">Horarios Disponibles</h3>
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full animate-pulse">
                  ● En tiempo real
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slotsForDay.map((s) => (
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
                    <span className="text-lg font-bold text-gray-800">{s.time}</span>
                    {s.demand === 'high' && <span className="text-[10px] uppercase font-bold text-orange-500 mt-1">Pocos cupos</span>}
                  </button>
                ))}
              </div>
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
                    <CardDescription>Ingresa los datos para generar tu reserva</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Patente Visual */}
                    <div className="space-y-3">
                      <Label className="text-xs uppercase font-bold tracking-wider text-gray-500">Patente Vehículo *</Label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          {/* Chile decorative strip */}
                        </div>
                        <div className="border-4 border-black rounded-lg p-1 bg-white shadow-sm inline-block max-w-[280px]">
                          <div className="border border-gray-200 rounded flex items-center relative h-20 w-full px-4 bg-white">
                            {/* Simulated Chile Plate Design */}
                            <div className="absolute left-2 top-2 bottom-2 w-8 flex flex-col justify-between items-center opacity-30">
                              <span className="text-[8px] font-bold">CHILE</span>
                            </div>
                            <Input
                              value={patent}
                              onChange={(e) => setPatent(e.target.value.toUpperCase())}
                              maxLength={6}
                              className="border-0 text-center text-5xl font-mono font-black tracking-[0.2em] outline-none shadow-none focus-visible:ring-0 uppercase placeholder:opacity-20 h-full w-full"
                              placeholder="AB-CD-12"
                            />
                          </div>
                          <div className="text-center text-[10px] font-bold tracking-widest mt-1">CHILE</div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Ingresa tu patente sin guiones</p>
                      </div>
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
                        <p className="text-xs text-gray-500">{commune?.name} • {selectedDateIso} • {selectedSlot.time}</p>
                      </div>
                      <span className="font-semibold">{formatClp(service!.base_price)}</span>
                    </div>

                    <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                      <span className="font-bold text-lg">Total</span>
                      <span className="font-black text-2xl text-primary">{formatClp(service!.base_price)}</span>
                    </div>

                    <Button
                      className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg mt-4"
                      onClick={() => createHold.mutate({ date: selectedSlot.date, time: selectedSlot.time })}
                      disabled={createHold.isPending}
                    >
                      {createHold.isPending ? "Procesando..." : "Confirmar y Pagar"}
                    </Button>
                  </CardContent>
                  <div className="px-6 pb-6 pt-2 text-center">
                    <p className="text-xs text-gray-400 mb-2">Pago 100% Seguro vía</p>
                    <div className="flex justify-center items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
                      <CreditCard className="h-6 w-6" />
                      <span className="font-bold italic">WebPay / Getnet</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
