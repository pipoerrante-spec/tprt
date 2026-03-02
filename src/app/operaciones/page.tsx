import { PortalDashboard } from "@/components/ops/portal-dashboard";
import { PortalLogin } from "@/components/ops/portal-login";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isOpsAuthenticated } from "@/lib/ops-auth";
import { getOperationsBookings } from "@/lib/ops-agenda";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const authenticated = await isOpsAuthenticated();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {!authenticated ? (
        <PortalLogin />
      ) : (
        await (async () => {
          try {
            const bookings = await getOperationsBookings();
            return <PortalDashboard bookings={bookings} />;
          } catch {
            return (
              <Card className="border-rose-200 bg-rose-50">
                <CardHeader>
                  <CardTitle>No pudimos cargar el portal</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-rose-700">
                  Revisa la conexión con Supabase e inténtalo nuevamente.
                </CardContent>
              </Card>
            );
          }
        })()
      )}
    </main>
  );
}
