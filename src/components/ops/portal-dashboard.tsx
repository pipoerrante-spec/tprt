"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, apiJson } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PortalBooking = {
  booking: {
    id: string;
    status: "confirmed" | "completed";
    date: string;
    time: string;
    customer_name: string;
    email: string;
    phone: string;
    address: string;
    notes: string | null;
    vehicle_plate: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_year: number | null;
    created_at: string;
  };
  payment: {
    id: string;
    amount_clp: number;
    provider: string;
    authorization_code: string | null;
    card_last4: string | null;
    transbank_buy_order: string | null;
    transbank_transaction_date: string | null;
  };
  commune: { id: string; name: string; region: string } | null;
  service: { id: string; name: string } | null;
  releaseState: { date: string; releasedUntilTime: string; completedBookingId: string | null } | null;
  nextTime: string | null;
  canComplete: boolean;
  canReleaseNext: boolean;
};

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function PortalDashboard({ bookings }: { bookings: PortalBooking[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [logoutPending, setLogoutPending] = React.useState(false);

  async function completeAndRelease(bookingId: string) {
    setPendingId(bookingId);
    try {
      const result = await apiJson<{ nextTime: string | null; releasedUntilTime: string }>(
        `/api/ops/bookings/${encodeURIComponent(bookingId)}/complete`,
        { method: "POST" },
      );
      toast.success(
        result.nextTime
          ? `Trabajo cerrado. Se liberó el bloque ${result.nextTime}.`
          : "Trabajo cerrado. No quedaban más bloques por liberar.",
      );
      router.refresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "complete_failed";
      toast.error(code === "unauthorized" ? "Sesión expirada." : "No pudimos completar la cita.");
    } finally {
      setPendingId(null);
    }
  }

  async function logout() {
    setLogoutPending(true);
    try {
      await apiJson("/api/ops/logout", { method: "POST" });
      router.refresh();
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Badge variant="warning">Operaciones</Badge>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Agenda operativa</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Aquí ves solo citas con pago confirmado. Cuando el operador termine, usa el botón para marcar la cita como
            completada y liberar el siguiente bloque del mismo día.
          </p>
        </div>
        <Button variant="outline" onClick={logout} disabled={logoutPending}>
          {logoutPending ? "Saliendo..." : "Cerrar sesión"}
        </Button>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Citas pagadas</CardTitle>
          <CardDescription>{bookings.length} cita(s) operativas en el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No hay citas pagadas todavía.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Liberación</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((item) => (
                  <TableRow key={item.booking.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{item.booking.date}</div>
                      <div className="text-xs text-slate-500">{item.booking.time.slice(0, 5)}</div>
                      <div className="text-xs text-slate-500">{item.commune?.name ?? "Sin comuna"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{item.booking.customer_name}</div>
                      <div className="text-xs text-slate-500">{item.booking.email}</div>
                      <div className="text-xs text-slate-500">{item.booking.phone}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.booking.address}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{item.booking.vehicle_plate ?? "Sin patente"}</div>
                      <div className="text-xs text-slate-500">
                        {[item.booking.vehicle_make, item.booking.vehicle_model].filter(Boolean).join(" ")}
                      </div>
                      <div className="text-xs text-slate-500">{item.booking.vehicle_year ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{formatClp(item.payment.amount_clp)}</div>
                      <div className="text-xs text-slate-500">
                        OC: {item.payment.transbank_buy_order ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Auth: {item.payment.authorization_code ?? "—"} · **** {item.payment.card_last4 ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.booking.status === "completed" ? "success" : "info"}>
                        {item.booking.status === "completed" ? "Completada" : "Confirmada"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-semibold text-slate-900">
                        Abierta hasta {item.releaseState?.releasedUntilTime ?? "07:30"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.nextTime ? `Siguiente bloque: ${item.nextTime}` : "No quedan más bloques ese día."}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={!item.canComplete || pendingId === item.booking.id}
                        onClick={() => completeAndRelease(item.booking.id)}
                      >
                        {pendingId === item.booking.id
                          ? "Procesando..."
                          : item.canReleaseNext
                            ? "Completar y liberar"
                            : "Completar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
