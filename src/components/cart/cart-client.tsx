"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api";
import { useCountdown } from "@/hooks/use-countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, ShoppingCart } from "lucide-react";

type HoldPublic = {
  id: string;
  service_id: string;
  commune_id: string;
  date: string;
  time: string;
  expires_at: string;
  status: "active" | "expired" | "converted" | "canceled";
};

type Service = { id: string; name: string; base_price: number };
type Commune = { id: string; name: string; region: string };

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CartClient({ holdId, couponCode }: { holdId: string | null; couponCode: string | null }) {
  const router = useRouter();

  const hold = useQuery({
    enabled: !!holdId,
    queryKey: ["hold", holdId],
    queryFn: () => apiJson<{ hold: HoldPublic }>(`/api/holds/${encodeURIComponent(holdId!)}`),
    refetchInterval: 2_000,
  });

  const expiresAt = hold.data?.hold?.expires_at;
  const countdown = useCountdown(expiresAt);

  const services = useQuery({
    queryKey: ["catalog", "services"],
    queryFn: () => apiJson<{ services: Service[] }>("/api/catalog/services"),
    enabled: !!hold.data?.hold,
  });

  const communes = useQuery({
    enabled: !!hold.data?.hold?.service_id,
    queryKey: ["catalog", "communes", hold.data?.hold?.service_id],
    queryFn: () =>
      apiJson<{ communes: Commune[] }>(
        `/api/catalog/communes?serviceId=${encodeURIComponent(hold.data!.hold.service_id)}`,
      ),
  });

  const holdRow = hold.data?.hold;
  const service = services.data?.services?.find((s) => s.id === holdRow?.service_id) ?? null;
  const commune = communes.data?.communes?.find((c) => c.id === holdRow?.commune_id) ?? null;
  const checkoutHref = couponCode
    ? `/checkout?holdId=${encodeURIComponent(holdId ?? "")}&coupon=${encodeURIComponent(couponCode)}`
    : `/checkout?holdId=${encodeURIComponent(holdId ?? "")}`;

  if (!holdId) {
    return (
      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Carrito</CardTitle>
          <CardDescription>Falta el parámetro de hold. Vuelve a reservar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/reservar">Ir a reservar</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>
          <ShoppingCart className="size-3.5" />
          Carrito
        </Badge>
        {holdRow?.status === "active" ? (
          <Badge variant={countdown.expired ? "danger" : "warning"}>
            <Clock className="size-3.5" />
            {countdown.expired ? "Expirado" : `Expira en ${countdown.mmss}`}
          </Badge>
        ) : null}
      </div>

      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Tu cupo</CardTitle>
          <CardDescription>Bloqueo temporal por 7 minutos. Si expira, se libera automáticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hold.isLoading ? (
            <Skeleton className="h-24" />
          ) : hold.isError ? (
            <div className="text-sm text-muted-foreground">No pudimos cargar el hold. Intenta nuevamente.</div>
          ) : !holdRow ? (
            <div className="text-sm text-muted-foreground">Hold no encontrado.</div>
          ) : (
            <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/30 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Servicio</div>
                <div className="text-sm font-medium">
                  {service ? service.name : <span className="text-muted-foreground">Cargando…</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Comuna</div>
                <div className="text-sm font-medium">
                  {commune ? commune.name : <span className="text-muted-foreground">Cargando…</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Fecha</div>
                <div className="text-sm font-medium">{holdRow.date}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Hora</div>
                <div className="text-sm font-medium">{holdRow.time}</div>
              </div>
              {service ? (
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-lg font-semibold tracking-tight">{formatClp(service.base_price)}</div>
                </div>
              ) : null}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => router.push("/reservar")}>
              Cambiar hora
            </Button>
            <Button
              size="lg"
              disabled={!holdRow || holdRow.status !== "active" || countdown.expired}
              asChild
            >
              <Link href={checkoutHref}>Pagar ahora</Link>
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Email es obligatorio para confirmación. SMS/WhatsApp es opcional en checkout.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
