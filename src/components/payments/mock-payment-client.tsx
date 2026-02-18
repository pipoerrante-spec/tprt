"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiJson } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle } from "lucide-react";

type Payment = {
  id: string;
  booking_id: string;
  provider: string;
  amount_clp: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded";
};

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function MockPaymentClient({ paymentId }: { paymentId: string | null }) {
  const router = useRouter();

  const payment = useQuery({
    enabled: !!paymentId,
    queryKey: ["payment", paymentId],
    queryFn: () => apiJson<{ payment: Payment }>(`/api/payments/${encodeURIComponent(paymentId!)}`),
    refetchInterval: 1_500,
  });

  const webhook = useMutation({
    mutationFn: (status: "paid" | "failed") =>
      apiJson<{ ok: boolean }>("/api/webhooks/mock", {
        method: "POST",
        body: JSON.stringify({ paymentId: paymentId!, status }),
      }),
    onSuccess: () => toast.success("Webhook procesado."),
    onError: () => toast.error("No pudimos procesar el webhook."),
  });

  const p = payment.data?.payment ?? null;

  if (!paymentId) {
    return (
      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Pago Mock</CardTitle>
          <CardDescription>Falta paymentId. Vuelve al checkout.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/reservar">Reservar</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Mock</Badge>
        {p ? <Badge>Estado: {p.status}</Badge> : null}
      </div>

      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Simulación de pago</CardTitle>
          <CardDescription>Esto existe solo para pruebas locales E2E con webhook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {payment.isLoading ? (
            <Skeleton className="h-24" />
          ) : !p ? (
            <div className="text-sm text-muted-foreground">Pago no encontrado.</div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-background/30 p-4 text-sm">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground">Monto</div>
                <div className="font-semibold">{formatClp(p.amount_clp)}</div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-muted-foreground">Booking</div>
                <div className="font-mono text-xs">{p.booking_id}</div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              disabled={!p || webhook.isPending}
              onClick={async () => {
                await webhook.mutateAsync("paid");
                router.push(`/confirmacion/${encodeURIComponent(p!.booking_id)}`);
              }}
            >
              <CheckCircle2 className="size-4 opacity-80" />
              Simular pago exitoso
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={!p || webhook.isPending}
              onClick={async () => {
                await webhook.mutateAsync("failed");
                router.push(`/confirmacion/${encodeURIComponent(p!.booking_id)}`);
              }}
            >
              <XCircle className="size-4 opacity-80" />
              Simular pago fallido
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

