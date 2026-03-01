import { CalendarWidget } from "@/components/calendar-widget";
import { BookingAvailabilityCalendar } from "@/components/calendar/booking-availability-calendar";
import { Card, CardContent } from "@/components/ui/card";

export default function CalendarioPage() {
    return (
        <main className="bg-white min-h-screen pb-20 pt-8">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-8">

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold text-primary">Calendario de Revisión Técnica</h1>
                    <p className="text-gray-600">
                        Conozca el mes en que le corresponde realizar la revisión técnica de su vehículo según el último dígito de su placa patente.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Widget Visual */}
                    <div className="space-y-6">
                        <CalendarWidget />

                        <Card className="bg-blue-50 border-blue-100">
                            <CardContent className="p-4 text-sm leading-6 text-blue-900">
                                <strong>Nota:</strong> Conducir con la revisión técnica vencida en Chile es una infracción grave que conlleva una multa de 1 a 1,5 UTM (aprox. $69.611 a $104.417 a febrero de 2026). Además de la multa económica, Carabineros puede retirar el vehículo de circulación y enviarlo a corrales, y la falta impide renovar el permiso de circulación. Considerando la grúa $52.444 aprox, corrales, trámites notariales, un descuido puede costar $200.000 además del estrés, quedas sin vehículo y corres riesgos de daños por grúa.
                            </CardContent>
                        </Card>
                    </div>

                    <BookingAvailabilityCalendar />
                </div>
            </div>
        </main>
    );
}
