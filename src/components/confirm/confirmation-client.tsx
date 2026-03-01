"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

type BookingResponse = {
  booking: {
    id: string;
    status: "pending_payment" | "confirmed" | "canceled" | "completed";
    date: string;
    time: string;
    customerName: string;
    emailMasked: string;
    service: { id: string; name: string } | null;
    commune: { id: string; name: string; region: string } | null;
    createdAt: string;
  };
  payment: {
    id: string;
    status: "pending" | "paid" | "failed" | "refunded";
    provider: string;
    amount_clp: number;
    currency: string;
    created_at: string;
    authorization_code?: string | null;
    card_last4?: string | null;
    response_code?: number | null;
    payment_type_code?: string | null;
    transbank_status?: string | null;
    transbank_buy_order?: string | null;
    transbank_session_id?: string | null;
    transbank_vci?: string | null;
    transbank_transaction_date?: string | null;
  } | null;
};

function statusBadge(status: BookingResponse["booking"]["status"], pay?: BookingResponse["payment"] | null) {
  if (pay?.status === "paid" && status === "confirmed") return { variant: "success" as BadgeVariant, label: "Confirmada" };
  if (pay?.status === "failed" || status === "canceled") return { variant: "danger" as BadgeVariant, label: "No pagada" };
  if (status === "pending_payment") return { variant: "warning" as BadgeVariant, label: "Pendiente de pago" };
  return { variant: "default" as BadgeVariant, label: status };
}

export function ConfirmationClient({ bookingId }: { bookingId: string }) {
  const booking = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => apiJson<BookingResponse>(`/api/bookings/${encodeURIComponent(bookingId)}`),
    refetchInterval: 2_500,
  });

  const data = booking.data;
  const badge = data ? statusBadge(data.booking.status, data.payment) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Confirmación</Badge>
        {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
      </div>

      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Estado de tu reserva</CardTitle>
          <CardDescription>Guarda tu ID para soporte y seguimiento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {booking.isLoading ? (
            <Skeleton className="h-28" />
          ) : booking.isError || !data ? (
            <div className="text-sm text-muted-foreground">No pudimos cargar la reserva.</div>
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-background/30 p-4 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">ID Reserva</div>
                    <div className="font-mono text-xs">{data.booking.id}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div className="text-sm font-medium">{data.booking.emailMasked}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Servicio</div>
                    <div className="text-sm font-medium">{data.booking.service?.name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Comuna</div>
                    <div className="text-sm font-medium">{data.booking.commune?.name ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Fecha</div>
                    <div className="text-sm font-medium">{data.booking.date}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Hora</div>
                    <div className="text-sm font-medium">{data.booking.time}</div>
                  </div>
                </div>
                {data.payment ? (
                  <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Monto</div>
                      <div className="text-sm font-medium">
                        {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
                          data.payment.amount_clp,
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Fecha transacción</div>
                      <div className="text-sm font-medium">
                        {data.payment.transbank_transaction_date ?? data.payment.created_at}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Orden de compra</div>
                      <div className="text-sm font-medium">{data.payment.transbank_buy_order ?? data.payment.id}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Código autorización</div>
                      <div className="text-sm font-medium">{data.payment.authorization_code ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Últimos 4 dígitos</div>
                      <div className="text-sm font-medium">{data.payment.card_last4 ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Respuesta gateway</div>
                      <div className="text-sm font-medium">
                        {data.payment.transbank_status ?? "—"}
                        {typeof data.payment.response_code === "number" ? ` / ${data.payment.response_code}` : ""}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {data.payment?.status === "paid" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
                  <CheckCircle2 className="mt-0.5 size-5 text-emerald-200" />
                  <div className="space-y-1">
                    <div className="font-medium text-emerald-50">Pago confirmado</div>
                    <div className="text-emerald-100/80">
                      Te enviamos un email de confirmación con los siguientes pasos y contacto.
                    </div>
                  </div>
                </div>
              ) : data.payment?.status === "failed" ? (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm">
                  <XCircle className="mt-0.5 size-5 text-rose-200" />
                  <div className="space-y-1">
                    <div className="font-medium text-rose-50">Pago no confirmado</div>
                    <div className="text-rose-100/80">
                      Puedes volver a intentar pagando nuevamente mientras haya cupos.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
                  <Clock className="mt-0.5 size-5 text-amber-200" />
                  <div className="space-y-1">
                    <div className="font-medium text-amber-50">Pendiente</div>
                    <div className="text-amber-100/80">
                      Si acabas de pagar, espera unos segundos. Esta página se actualiza automáticamente.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/reservar">Nueva reserva</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/ayuda">Ayuda</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
