import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-2">
        <Badge variant="warning">Admin</Badge>
      </div>
      <Card className="mt-6 bg-card/40">
        <CardHeader>
          <CardTitle>Panel administrativo (opcional)</CardTitle>
          <CardDescription>
            Preparado para gestionar servicios, comunas y reglas de disponibilidad con protección por Auth/claims.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          En esta entrega dejamos el panel como placeholder. El backend ya soporta reglas por comuna/servicio y capacity,
          con RLS para admin/owner cuando se use Auth.
        </CardContent>
      </Card>
    </main>
  );
}

