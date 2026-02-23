"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WebpayRedirectClient({ url, token }: { url: string | null; token: string | null }) {
  const formRef = React.useRef<HTMLFormElement | null>(null);

  React.useEffect(() => {
    if (!url || !token) return;
    const t = setTimeout(() => formRef.current?.submit(), 50);
    return () => clearTimeout(t);
  }, [url, token]);

  if (!url || !token) {
    return (
      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Webpay</CardTitle>
          <CardDescription>Faltan parámetros para redirigir a Webpay.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/reservar">Volver a reservar</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Webpay</Badge>
        <Badge>Redirigiendo…</Badge>
      </div>

      <Card className="bg-card/40">
        <CardHeader>
          <CardTitle>Conectando con Webpay</CardTitle>
          <CardDescription>Si no te redirige automáticamente, usa el botón.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form ref={formRef} action={url} method="POST">
            <input type="hidden" name="token_ws" value={token} />
            <Button size="lg" type="submit">
              Ir a Webpay
            </Button>
          </form>
          <div className="text-xs text-muted-foreground">Nunca compartas este enlace ni el token de pago.</div>
        </CardContent>
      </Card>
    </div>
  );
}

