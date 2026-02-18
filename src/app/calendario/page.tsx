import { CalendarWidget } from "@/components/calendar-widget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
                            <CardContent className="p-4 text-sm text-blue-800">
                                <strong>Nota:</strong> Si su revisión técnica está vencida, puede realizar el trámite en cualquier momento, pero se expone a multas de tránsito si circula con el documento vencido.
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabla Detallada */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg text-primary">Detalle por Tipo de Vehículo</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Mes</TableHead>
                                        <TableHead className="text-center">Automóviles (Dígito)</TableHead>
                                        <TableHead className="text-center">Taxis/Buses</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[
                                        { month: "Enero", auto: "9", taxi: "9-0" },
                                        { month: "Febrero", auto: "0", taxi: "1-2" },
                                        { month: "Marzo", auto: "-", taxi: "3-4" },
                                        { month: "Abril", auto: "1", taxi: "5-6" },
                                        { month: "Mayo", auto: "2", taxi: "7-8" },
                                        { month: "Junio", auto: "3", taxi: "9-0" },
                                        { month: "Julio", auto: "4", taxi: "1-2" },
                                        { month: "Agosto", auto: "5", taxi: "3-4" },
                                        { month: "Septiembre", auto: "6", taxi: "5-6" },
                                        { month: "Octubre", auto: "7", taxi: "7-8" },
                                        { month: "Noviembre", auto: "8", taxi: "-" },
                                        { month: "Diciembre", auto: "-", taxi: "-" },
                                    ].map((row) => (
                                        <TableRow key={row.month}>
                                            <TableCell className="font-medium">{row.month}</TableCell>
                                            <TableCell className="text-center font-bold text-primary">{row.auto}</TableCell>
                                            <TableCell className="text-center text-gray-500">{row.taxi}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
