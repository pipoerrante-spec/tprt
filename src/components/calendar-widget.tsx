"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChileMonthIndex, REVISION_CALENDAR } from "@/lib/revision-calendar";

export function CalendarWidget() {
    const currentMonthIndex = getChileMonthIndex();

    return (
        <Card className="border-t-4 border-t-primary shadow-sm">
            <CardHeader className="bg-muted/50 pb-2">
                <CardTitle className="text-lg text-primary flex items-center gap-2">
                    <span>📅</span> Calendario de Revisión
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-3 text-sm">
                    {REVISION_CALENDAR.map((item, index) => {
                        const isCurrent = index === currentMonthIndex;
                        const hasDigit = item.auto !== "-";
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
                                    {hasDigit ? (
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white font-bold text-xs">
                                            {item.auto}
                                        </span>
                                    ) : (
                                        <span className="text-base font-semibold text-gray-300">-</span>
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
