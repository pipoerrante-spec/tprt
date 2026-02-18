"use client";

import * as React from "react";
import { Clock } from "lucide-react";

export function UrgencyTimer() {
    const [timeLeft, setTimeLeft] = React.useState(600); // 10 minutes in seconds

    React.useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

    return (
        <div className="bg-[#FF1D18] text-white py-3 px-4 rounded-t-xl flex items-center justify-center gap-3 shadow-md animate-pulse">
            <Clock className="h-6 w-6 font-bold" />
            <div className="text-center">
                <span className="font-black text-2xl sm:text-3xl tracking-widest tabular-nums">
                    {formattedMinutes}:{formattedSeconds}
                </span>
                <span className="hidden sm:inline ml-2 font-semibold uppercase text-xs tracking-wide opacity-90">
                    Minutos para concretar reserva
                </span>
            </div>
        </div>
    );
}
