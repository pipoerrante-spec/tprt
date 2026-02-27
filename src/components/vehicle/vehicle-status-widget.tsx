"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiJson } from "@/lib/api";
import { normalizePlate } from "@/lib/vehicle/plate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Vehicle = {
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  version: string | null;
  color: string | null;
  vinNumber: string | null;
  engineNumber: string | null;
  engine: string | null;
  fuel: string | null;
  transmission: string | null;
  doors: number | null;
  vehicleType: string | null;
  monthRT: string | null;
  source: string;
};

export function VehicleStatusWidget() {
  const [plate, setPlate] = React.useState("");
  const [vehicle, setVehicle] = React.useState<Vehicle | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const lookup = useMutation({
    mutationFn: async (p: string) =>
      apiJson<{ vehicle: Vehicle }>("/api/vehicle/lookup", {
        method: "POST",
        body: JSON.stringify({ plate: p }),
      }),
    onSuccess: (data, requestedPlate) => {
      const v = data.vehicle;
      setVehicle(v);
      setPlate(v.plate || requestedPlate);
      setIsModalOpen(true);
      if (v.make || v.model || v.year) toast.success("Vehículo detectado.");
      else toast.message("No encontramos datos automáticos. Puedes continuar manualmente.");
    },
    onError: () => toast.error("No pudimos consultar tu patente. Intenta nuevamente."),
  });

  React.useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen]);

  const normalized = normalizePlate(plate);
  const hasData = Boolean(vehicle && (vehicle.make || vehicle.model || vehicle.year));
  const vehicleName = vehicle
    ? [vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : null].filter(Boolean).join(" ")
    : "";

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2 mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          const p = normalizePlate(plate);
          if (p.length < 5) {
            toast.error("Ingresa una patente válida.");
            return;
          }
          lookup.mutate(p);
        }}
      >
        <Input
          className="w-36 bg-gray-50"
          value={plate}
          onChange={(e) => setPlate(normalizePlate(e.target.value))}
          placeholder="AABB12"
          inputMode="text"
          autoComplete="off"
        />
        <Button size="sm" className="bg-primary text-white font-bold" disabled={lookup.isPending}>
          {lookup.isPending ? "..." : "CONSULTAR"}
        </Button>
      </form>

      {isModalOpen && vehicle ? (
        <div
          className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Resultado de patente"
            className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <h4 className="text-lg font-bold text-gray-900">Resultado de patente</h4>
              <p className="text-sm text-gray-600">Información obtenida automáticamente</p>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className={`rounded-xl border p-3 ${hasData ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                <p className={`text-sm font-semibold ${hasData ? "text-green-700" : "text-amber-700"}`}>
                  {hasData ? "Encontramos datos de tu auto" : "No encontramos datos completos"}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {hasData ? "Puedes continuar con la reserva usando estos datos." : "Puedes seguir con reserva y completar manualmente."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-gray-500">Patente</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.plate || normalized || "—"}</span>
                <span className="text-gray-500">Vehículo</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicleName || "—"}</span>
                <span className="text-gray-500">Tipo</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.vehicleType || "—"}</span>
                <span className="text-gray-500">Marca</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.make || "—"}</span>
                <span className="text-gray-500">Modelo</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.model || "—"}</span>
                <span className="text-gray-500">Año</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.year ? String(vehicle.year) : "—"}</span>
                <span className="text-gray-500">Versión</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.version || "—"}</span>
                <span className="text-gray-500">Color</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.color || "—"}</span>
                <span className="text-gray-500">Combustible</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.fuel || "—"}</span>
                <span className="text-gray-500">Transmisión</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.transmission || "—"}</span>
                <span className="text-gray-500">Puertas</span>
                <span className="col-span-2 font-semibold text-gray-900">
                  {typeof vehicle.doors === "number" ? String(vehicle.doors) : "—"}
                </span>
                <span className="text-gray-500">VIN/Chasis</span>
                <span className="col-span-2 font-semibold text-gray-900 break-all">{vehicle.vinNumber || "—"}</span>
                <span className="text-gray-500">Nro motor</span>
                <span className="col-span-2 font-semibold text-gray-900 break-all">{vehicle.engineNumber || "—"}</span>
                <span className="text-gray-500">Motor</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.engine || "—"}</span>
                <span className="text-gray-500">Mes RT</span>
                <span className="col-span-2 font-semibold text-gray-900">{vehicle.monthRT || "—"}</span>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cerrar
              </Button>
              <Button asChild size="sm" className="bg-primary text-white">
                <Link href="/reservar">Agendar retiro</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
