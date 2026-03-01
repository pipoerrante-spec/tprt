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
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, CreditCard, Shield } from "lucide-react";
import { normalizePlate } from "@/lib/vehicle/plate";
import { DEMO_COUPON_CODE, DEMO_COUPON_DISCOUNT_PERCENT, applyDiscount, normalizeCouponCode } from "@/lib/pricing";

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
  vehiclePlate: z.string().trim().min(5, "Ingresa la patente").max(12),
  vehicleMake: z.string().trim().min(2, "Ingresa la marca").max(40),
  vehicleModel: z.string().trim().min(1, "Ingresa el modelo").max(60),
  vehicleYear: z
    .string()
    .trim()
    .max(4, "Año inválido")
    .optional()
    .refine((v) => !v || /^\d{4}$/.test(v), "Año inválido"),
  address: z.string().trim().min(5, "Ingresa una dirección").max(160),
  notes: z.string().trim().max(500).optional(),
  couponCode: z.string().trim().max(32).optional(),
  consentPrivacy: z.boolean().refine((v) => v === true, "Debes aceptar la política de privacidad"),
  provider: z.literal("transbank_webpay"),
});

type FormValues = z.infer<typeof formSchema>;
const CHECKOUT_PREFILL_KEY = "gvrt_checkout_prefill_v1";
const HOLD_STORAGE_KEY = "gvrt_hold_id_v1";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatClp(amount: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CheckoutClient({
  holdId,
  initialCouponCode,
}: {
  holdId: string | null;
  initialCouponCode: string | null;
}) {
  const router = useRouter();
  const [effectiveHoldId, setEffectiveHoldId] = React.useState<string | null>(holdId);
  const normalizedInitialCoupon = normalizeCouponCode(initialCouponCode);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: "",
      email: "",
      phone: "",
      vehiclePlate: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      address: "",
      notes: "",
      couponCode: normalizedInitialCoupon ?? "",
      consentPrivacy: false,
      provider: "transbank_webpay",
    },
    mode: "onBlur",
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(CHECKOUT_PREFILL_KEY);
    if (!raw) return;
    let parsed: Partial<FormValues> = {};
    try {
      parsed = JSON.parse(raw) as Partial<FormValues>;
    } catch {
      return;
    }
    const fields: Array<keyof FormValues> = [
      "customerName",
      "email",
      "phone",
      "vehiclePlate",
      "vehicleMake",
      "vehicleModel",
      "vehicleYear",
      "address",
      "notes",
      "couponCode",
    ];
    for (const field of fields) {
      const current = form.getValues(field);
      const incoming = parsed[field];
      if ((current === "" || current == null) && incoming != null && incoming !== "") {
        form.setValue(field, incoming as FormValues[typeof field], { shouldDirty: false });
      }
    }
  }, [form]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (holdId && isUuid(holdId)) {
      setEffectiveHoldId(holdId);
      window.localStorage.setItem(HOLD_STORAGE_KEY, holdId);
      return;
    }
    const cached = window.localStorage.getItem(HOLD_STORAGE_KEY);
    if (cached && isUuid(cached)) setEffectiveHoldId(cached);
  }, [holdId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (holdId || !effectiveHoldId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("holdId", effectiveHoldId);
    if (normalizedInitialCoupon) url.searchParams.set("coupon", normalizedInitialCoupon);
    router.replace(url.pathname + "?" + url.searchParams.toString());
  }, [effectiveHoldId, holdId, normalizedInitialCoupon, router]);

  React.useEffect(() => {
    const sub = form.watch((values) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        CHECKOUT_PREFILL_KEY,
        JSON.stringify({
          customerName: values.customerName ?? "",
          email: values.email ?? "",
          phone: values.phone ?? "",
          vehiclePlate: values.vehiclePlate ?? "",
          vehicleMake: values.vehicleMake ?? "",
          vehicleModel: values.vehicleModel ?? "",
          vehicleYear: values.vehicleYear ?? "",
          address: values.address ?? "",
          notes: values.notes ?? "",
          couponCode: values.couponCode ?? "",
        }),
      );
    });
    return () => sub.unsubscribe();
  }, [form]);

  const consentPrivacy = useWatch({ control: form.control, name: "consentPrivacy" });
  const vehiclePlate = useWatch({ control: form.control, name: "vehiclePlate" });
  const couponCode = useWatch({ control: form.control, name: "couponCode" });
  const lastLookupPlateRef = React.useRef<string>("");

  const vehicleLookup = useMutation({
    mutationFn: async (plate: string) =>
      apiJson<{
        vehicle: { plate: string; make: string | null; model: string | null; year: number | null; source: string };
      }>("/api/vehicle/lookup", {
        method: "POST",
        body: JSON.stringify({ plate }),
      }),
    onSuccess: (data) => {
      const v = data.vehicle;
      if (v.make && !form.getValues("vehicleMake")) form.setValue("vehicleMake", v.make);
      if (v.model && !form.getValues("vehicleModel")) form.setValue("vehicleModel", v.model);
      if (typeof v.year === "number" && !form.getValues("vehicleYear")) form.setValue("vehicleYear", String(v.year));
    },
  });

  React.useEffect(() => {
    const normalized = normalizePlate(vehiclePlate || "");
    if (normalized.length < 5) return;
    if (lastLookupPlateRef.current === normalized) return;
    const t = setTimeout(() => {
      lastLookupPlateRef.current = normalized;
      vehicleLookup.mutate(normalized);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiclePlate]);

  const hold = useQuery({
    enabled: !!effectiveHoldId,
    queryKey: ["hold", effectiveHoldId],
    queryFn: () => apiJson<{ hold: HoldPublic }>(`/api/holds/${encodeURIComponent(effectiveHoldId!)}`),
    refetchInterval: false,
    refetchOnWindowFocus: false,
    retry: 1,
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
      if (!effectiveHoldId) throw new Error("missing_hold_id");
      return apiJson<{
        bookingId: string;
        paymentId: string;
        provider: string;
        redirectUrl: string;
        amountClp: number;
        baseAmountClp: number;
        discountAmountClp: number;
        discountPercent: number;
        couponCode: string | null;
      }>("/api/checkout/start", {
        method: "POST",
        body: JSON.stringify({
          holdId: effectiveHoldId,
          customerName: values.customerName,
          email: values.email,
          phone: values.phone,
          vehiclePlate: values.vehiclePlate,
          vehicleMake: values.vehicleMake,
          vehicleModel: values.vehicleModel,
          vehicleYear: values.vehicleYear ? Number(values.vehicleYear) : null,
          address: values.address,
          notes: values.notes || null,
          couponCode: values.couponCode || null,
          provider: "transbank_webpay",
        }),
      });
    },
    onSuccess: (data) => {
      toast.success(data.redirectUrl.startsWith("/confirmacion/") ? "Reserva confirmada." : "Redirigiendo a Webpay…");
      window.location.href = data.redirectUrl;
    },
    onError: (e) => {
      const code = e instanceof ApiError ? e.code : e instanceof Error ? e.message : "checkout_failed";
      if (code === "hold_not_active" || code === "hold_not_found" || code === "hold_unavailable") {
        toast.error("Tu bloqueo ya no está disponible. Vuelve al carrito y genera un nuevo cupo.");
      }
      else if (code === "slot_full") {
        toast.error("Ese horario se llenó mientras avanzabas. Elige otro cupo para continuar.");
      }
      else if (code === "slot_not_available") {
        toast.error("Ese horario ya no está disponible. Vuelve al carrito y selecciona otro.");
      }
      else if (code === "invalid_coupon") toast.error("Cupón inválido. Usa un código válido.");
      else if (code.includes("not_implemented") || code.includes("not_configured")) {
        toast.error("Proveedor de pago no disponible en este entorno.");
      } else toast.error("No pudimos iniciar el pago. Intenta nuevamente.");
    },
  });

  const onSubmit = form.handleSubmit((values) => startCheckout.mutate(values));
  const baseAmountClp = service?.base_price ?? 85_000;
  const normalizedCouponCode = normalizeCouponCode(couponCode);
  const previewDiscountPercent = normalizedCouponCode === DEMO_COUPON_CODE ? DEMO_COUPON_DISCOUNT_PERCENT : 0;
  const previewAmounts = applyDiscount(baseAmountClp, previewDiscountPercent);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (holdRow?.status === "expired" || holdRow?.status === "canceled") {
      window.localStorage.removeItem(HOLD_STORAGE_KEY);
    }
  }, [holdRow?.status]);

  if (!effectiveHoldId) {
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
          Paso final
        </Badge>
        <Badge>
          <CheckCircle2 className="size-3.5" />
          Cupo reservado
        </Badge>
        <Badge variant="success">
          <Shield className="size-3.5" />
          Pago seguro
        </Badge>
      </div>

      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
          <CardDescription>Verifica datos antes de pagar.</CardDescription>
        </CardHeader>
        <CardContent>
          {hold.isLoading && !holdRow ? (
            <Skeleton className="h-20" />
          ) : !holdRow && hold.isError ? (
            <div className="text-sm text-muted-foreground">
              No pudimos cargar el hold. Vuelve al carrito y refresca para continuar con el pago.
            </div>
          ) : !holdRow ? (
            <div className="text-sm text-muted-foreground">
              Hold no encontrado. Vuelve al carrito para regenerar el bloqueo antes de pagar.
            </div>
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
                <>
                  <div className="sm:col-span-2 flex items-center justify-between text-sm">
                    <div className="text-xs text-muted-foreground">Subtotal</div>
                    <div className="font-medium">{formatClp(baseAmountClp)}</div>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between text-sm">
                    <div className="text-xs text-muted-foreground">Descuento</div>
                    <div className={previewDiscountPercent > 0 ? "font-medium text-emerald-600" : "font-medium"}>
                      {previewDiscountPercent > 0 ? `- ${formatClp(previewAmounts.discountAmountClp)}` : formatClp(0)}
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-between pt-1">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-lg font-semibold tracking-tight">{formatClp(previewAmounts.finalAmountClp)}</div>
                  </div>
                </>
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
                <Label htmlFor="vehiclePlate">Patente</Label>
                <Input
                  id="vehiclePlate"
                  placeholder="ABCD12"
                  {...form.register("vehiclePlate", { setValueAs: (v) => normalizePlate(String(v ?? "")) })}
                />
                {vehicleLookup.isPending ? (
                  <div className="text-xs text-muted-foreground">Detectando marca/modelo…</div>
                ) : null}
                {form.formState.errors.vehiclePlate ? (
                  <div className="text-xs text-rose-200">{form.formState.errors.vehiclePlate.message}</div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleMake">Marca</Label>
                <Input id="vehicleMake" placeholder="Toyota" {...form.register("vehicleMake")} />
                {form.formState.errors.vehicleMake ? (
                  <div className="text-xs text-rose-200">{form.formState.errors.vehicleMake.message}</div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleModel">Modelo</Label>
                <Input id="vehicleModel" placeholder="Yaris" {...form.register("vehicleModel")} />
                {form.formState.errors.vehicleModel ? (
                  <div className="text-xs text-rose-200">{form.formState.errors.vehicleModel.message}</div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleYear">Año (opcional)</Label>
                <Input id="vehicleYear" inputMode="numeric" placeholder="2018" {...form.register("vehicleYear")} />
                {form.formState.errors.vehicleYear ? (
                  <div className="text-xs text-rose-200">{form.formState.errors.vehicleYear.message}</div>
                ) : null}
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="couponCode">Cupón de descuento (opcional)</Label>
                <Input id="couponCode" placeholder={`Ej: ${DEMO_COUPON_CODE}`} {...form.register("couponCode")} />
                <div className="text-xs text-muted-foreground">
                  Si tienes un cupón vigente, ingrésalo aquí antes de pagar.
                </div>
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
            </div>

            <Card className="bg-background/30">
              <CardHeader>
                <CardTitle className="text-base">Método de pago</CardTitle>
                <CardDescription>Pago seguro con Webpay.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-4">
                  <CreditCard className="size-5 text-primary" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Webpay</div>
                    <div className="text-sm text-muted-foreground">
                      Redirección segura con confirmación automática del pago en el servidor.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  router.push(
                    normalizedCouponCode
                      ? `/carrito?holdId=${effectiveHoldId}&coupon=${encodeURIComponent(normalizedCouponCode)}`
                      : `/carrito?holdId=${effectiveHoldId}`,
                  )
                }
              >
                Volver al carrito
              </Button>
              <Button
                size="lg"
                type="submit"
                disabled={
                  startCheckout.isPending || !holdRow || holdRow.status === "expired" || holdRow.status === "canceled"
                }
              >
                {startCheckout.isPending ? "Iniciando pago…" : "Pagar con Webpay"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
