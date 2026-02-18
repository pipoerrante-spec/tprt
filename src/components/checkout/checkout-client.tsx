"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiJson, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Clock, CreditCard, Shield } from "lucide-react";

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

const formSchema = z.object({
  customerName: z.string().trim().min(2, "Ingresa tu nombre").max(80),
  email: z.string().trim().email("Email inválido").max(254),
  phone: z.string().trim().min(7, "Teléfono inválido").max(30),
  vehiclePlate: z.string().trim().max(12).optional(),
  address: z.string().trim().min(5, "Ingresa una dirección").max(160),
  notes: z.string().trim().max(500).optional(),
  consentPrivacy: z.boolean().refine((v) => v === true, "Debes aceptar la política de privacidad"),
  consentSmsWhatsapp: z.boolean().optional(),
  provider: z.enum(["mock", "transbank_webpay", "flow", "mercadopago"]),
});

type FormValues = z.infer<typeof formSchema>;

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CheckoutClient({ holdId }: { holdId: string | null }) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      email: "",
      phone: "",
      vehiclePlate: "",
      address: "",
      notes: "",
      consentPrivacy: false,
      consentSmsWhatsapp: false,
      provider: "mock",
    },
    mode: "onBlur",
  });

  const consentPrivacy = useWatch({ control: form.control, name: "consentPrivacy" });
  const consentSmsWhatsapp = useWatch({ control: form.control, name: "consentSmsWhatsapp" });
  const provider = useWatch({ control: form.control, name: "provider" });

  const hold = useQuery({
    enabled: !!holdId,
    queryKey: ["hold", holdId],
    queryFn: () => apiJson<{ hold: HoldPublic }>(`/api/holds/${encodeURIComponent(holdId!)}`),
    refetchInterval: 2_000,
  });

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

  const holdRow = hold.data?.hold ?? null;
  const service = services.data?.services?.find((s) => s.id === holdRow?.service_id) ?? null;
  const commune = communes.data?.communes?.find((c) => c.id === holdRow?.commune_id) ?? null;

  const startCheckout = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!holdId) throw new Error("missing_hold_id");
      return apiJson<{
        bookingId: string;
        paymentId: string;
        provider: string;
        redirectUrl: string;
        amountClp: number;
      }>("/api/checkout/start", {
        method: "POST",
        body: JSON.stringify({
          holdId,
          customerName: values.customerName,
          email: values.email,
          phone: values.phone,
          vehiclePlate: values.vehiclePlate || null,
          address: values.address,
          notes: values.notes || null,
          provider: values.provider,
        }),
      });
    },
    onSuccess: (data) => {
      toast.success("Redirigiendo a pago…");
      window.location.href = data.redirectUrl;
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : "checkout_failed";
      if (code === "hold_not_active") toast.error("Tu hold expiró. Vuelve a reservar una hora.");
      else if (code.includes("not_implemented") || code.includes("not_configured")) {
        toast.error("Proveedor de pago no disponible en este entorno. Usa Mock en local.");
      } else toast.error("No pudimos iniciar el pago. Intenta nuevamente.");
    },
  });

  const onSubmit = form.handleSubmit((values) => startCheckout.mutate(values));

  if (!holdId) {
    return (
      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Checkout</CardTitle>
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
        <Badge variant="info">
          <CreditCard className="size-3.5" />
          Checkout
        </Badge>
        <Badge>
          <Clock className="size-3.5" />
          Hold: {holdRow?.status ?? "…"}
        </Badge>
        <Badge variant="success">
          <Shield className="size-3.5" />
          Server-side
        </Badge>
      </div>

      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
          <CardDescription>Verifica datos antes de pagar.</CardDescription>
        </CardHeader>
        <CardContent>
          {hold.isLoading ? (
            <Skeleton className="h-20" />
          ) : !holdRow ? (
            <div className="text-sm text-muted-foreground">Hold no encontrado.</div>
          ) : (
            <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/30 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Servicio</div>
                <div className="text-sm font-medium">{service?.name ?? "Cargando…"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Comuna</div>
                <div className="text-sm font-medium">{commune?.name ?? "Cargando…"}</div>
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
        </CardContent>
      </Card>

      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Datos</CardTitle>
          <CardDescription>Email es obligatorio para confirmación. SMS/WhatsApp es opcional.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Nombre</Label>
                <Input id="customerName" {...form.register("customerName")} />
                {form.formState.errors.customerName ? (
                  <div className="text-xs text-rose-200">{form.formState.errors.customerName.message}</div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...form.register("email")} />
                {form.formState.errors.email ? (
                  <div className="text-xs text-rose-200">{form.formState.errors.email.message}</div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" inputMode="tel" {...form.register("phone")} />
                {form.formState.errors.phone ? (
                  <div className="text-xs text-rose-200">{form.formState.errors.phone.message}</div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehiclePlate">Patente (opcional)</Label>
                <Input id="vehiclePlate" placeholder="ABCD12" {...form.register("vehiclePlate")} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" placeholder="Calle 123, Depto, Comuna…" {...form.register("address")} />
                {form.formState.errors.address ? (
                  <div className="text-xs text-rose-200">{form.formState.errors.address.message}</div>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea id="notes" placeholder="Indicaciones, referencia, horario preferido…" {...form.register("notes")} />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={consentPrivacy}
                  onCheckedChange={(v) => form.setValue("consentPrivacy", v === true, { shouldValidate: true })}
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium">Acepto política de privacidad</div>
                  <div className="text-xs text-muted-foreground">
                    Usaremos tus datos solo para gestionar tu reserva, enviar confirmación y soporte.
                  </div>
                  {form.formState.errors.consentPrivacy ? (
                    <div className="text-xs text-rose-200">{form.formState.errors.consentPrivacy.message}</div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={consentSmsWhatsapp ?? false}
                  onCheckedChange={(v) => form.setValue("consentSmsWhatsapp", v === true)}
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium">Quiero recordatorios por SMS/WhatsApp (opcional)</div>
                  <div className="text-xs text-muted-foreground">Podemos contactarte solo para esta reserva.</div>
                </div>
              </div>
            </div>

            <Card className="bg-background/30">
              <CardHeader>
                <CardTitle className="text-base">Método de pago</CardTitle>
                <CardDescription>
                  Webpay es preferido en producción. En local usamos Mock E2E con webhook.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={provider}
                  onValueChange={(v) => form.setValue("provider", v as FormValues["provider"])}
                >
                  <TabsList>
                    <TabsTrigger value="mock">Mock (local)</TabsTrigger>
                    <TabsTrigger value="transbank_webpay">Webpay</TabsTrigger>
                    <TabsTrigger value="flow">Flow</TabsTrigger>
                  </TabsList>
                  <TabsContent value="mock">
                    <div className="text-sm text-muted-foreground">
                      Simula pago exitoso/fallido y procesa webhook local para confirmar la reserva.
                    </div>
                  </TabsContent>
                  <TabsContent value="transbank_webpay">
                    <div className="text-sm text-muted-foreground">
                      Preparado como provider seguro server-side (llaves solo en backend).
                    </div>
                  </TabsContent>
                  <TabsContent value="flow">
                    <div className="text-sm text-muted-foreground">
                      Provider fallback preparado (interfaz). Activación por configuración.
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" type="button" onClick={() => router.push(`/carrito?holdId=${holdId}`)}>
                Volver al carrito
              </Button>
              <Button size="lg" type="submit" disabled={startCheckout.isPending || holdRow?.status !== "active"}>
                {startCheckout.isPending ? "Iniciando pago…" : "Pagar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
