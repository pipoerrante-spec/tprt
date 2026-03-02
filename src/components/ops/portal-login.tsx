"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError, apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortalLogin() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await apiJson("/api/ops/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      router.refresh();
      toast.success("Acceso concedido.");
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "login_failed";
      toast.error(code === "invalid_credentials" ? "Credenciales incorrectas." : "No pudimos iniciar sesión.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto mt-12 max-w-md border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle>Portal de Operaciones</CardTitle>
        <CardDescription>Acceso interno para revisar citas pagadas y liberar agenda.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ops-username">Usuario</Label>
            <Input id="ops-username" value={username} onChange={(event) => setUsername(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ops-password">Clave</Label>
            <Input
              id="ops-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Ingresando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
