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
  source: string;
};

export function VehicleStatusWidget() {
  const [plate, setPlate] = React.useState("");
  const [vehicle, setVehicle] = React.useState<Vehicle | null>(null);

  const lookup = useMutation({
    mutationFn: async (p: string) =>
      apiJson<{ vehicle: Vehicle }>("/api/vehicle/lookup", {
        method: "POST",
        body: JSON.stringify({ plate: p }),
      }),
    onSuccess: (data) => {
      setVehicle(data.vehicle);
      const v = data.vehicle;
      if (v.make || v.model || v.year) toast.success("Vehículo detectado.");
      else toast.message("No pudimos detectar tu vehículo. Puedes continuar igual.");
    },
    onError: () => toast.error("No pudimos consultar tu patente. Intenta nuevamente."),
  });

  const normalized = normalizePlate(plate);

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
          className="w-32 bg-gray-50"
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

      {vehicle ? (
        <div className="text-xs text-gray-500">
          <div>
            <span className="font-semibold">Patente:</span> {vehicle.plate || normalized || "—"}
          </div>
          <div>
            <span className="font-semibold">Vehículo:</span>{" "}
            {[vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : null].filter(Boolean).join(" ") || "—"}
          </div>
          <div className="mt-1">
            <Button asChild size="sm" variant="link" className="h-auto p-0 text-primary font-bold">
              <Link href="/reservar">Agendar retiro</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

