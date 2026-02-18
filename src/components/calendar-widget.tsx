"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const calendarData = [
    { month: "Enero", digits: ["9"] },
    { month: "Febrero", digits: ["0"] },
    { month: "Marzo", digits: [] }, // Usually blank or specific
    { month: "Abril", digits: ["1"] },
    { month: "Mayo", digits: ["2"] },
    { month: "Junio", digits: ["3"] },
    { month: "Julio", digits: ["4"] },
    { month: "Agosto", digits: ["5"] },
    { month: "Septiembre", digits: ["6"] },
    { month: "Octubre", digits: ["7"] },
    { month: "Noviembre", digits: ["8"] },
    { month: "Diciembre", digits: [] },
];

export function CalendarWidget() {
    const currentMonthIndex = new Date().getMonth();

    return (
        <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="bg-muted/50 pb-2">
                <CardTitle className="text-lg text-primary flex items-center gap-2">
                    <span>📅</span> Calendario de Revisión
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-3 text-sm">
                    {calendarData.map((item, index) => {
                        const isCurrent = index === currentMonthIndex;
                        return (
                            <div
                                key={item.month}
                                className={`
                  flex flex-col items-center justify-center p-3 border-b border-r last:border-r-0
                  ${isCurrent ? "bg-primary/5" : ""}
                `}
                            >
                                <span className={`font-semibold ${isCurrent ? "text-primary" : "text-gray-600"}`}>
                                    {item.month.slice(0, 3)}
                                </span>
                                <div className="mt-1 flex gap-1">
                                    {item.digits.length > 0 ? (
                                        item.digits.map(d => (
                                            <span key={d} className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white font-bold text-xs">
                                                {d}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-gray-300 text-xs">-</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-3 text-xs text-gray-500 bg-gray-50 text-center">
                    * Digito correspondiente al último número de la patente
                </div>
            </CardContent>
        </Card>
    );
}
