"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";

interface QueueModalProps {
    onComplete: () => void;
}

export function QueueModal({ onComplete }: QueueModalProps) {
    const [progress, setProgress] = React.useState(0);
    const [position, setPosition] = React.useState(0);
    const [totalInQueue, setTotalInQueue] = React.useState(0);
    const initialPosRef = React.useRef(0);

    React.useEffect(() => {
        // Randomize queue on mount
        const startPos = Math.floor(Math.random() * (45 - 12 + 1) + 12);
        const total = startPos + Math.floor(Math.random() * (150 - 50 + 1) + 50);

        setPosition(startPos);
        setTotalInQueue(total);
        initialPosRef.current = startPos;

        // Simulate queue movement
        const interval = setInterval(() => {
            setPosition((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setProgress(100);
                    return 1;
                }

                // Random check to see if queue moves forward
                if (Math.random() > 0.4) {
                    const newPos = prev - 1;

                    // Calculate exact progress percentage based on positions
                    // If we started at 50, and are at 40, we progressed 10 spots. 10/50 = 20%
                    if (initialPosRef.current > 0) {
                        const totalSpotsMoved = initialPosRef.current - newPos;
                        const calculatedProgress = (totalSpotsMoved / initialPosRef.current) * 100;
                        setProgress(Math.min(100, Math.max(0, calculatedProgress)));
                    }
                    return newPos;
                }
                return prev;
            });
        }, 600);

        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        if (progress >= 100) {
            setTimeout(() => {
                onComplete();
            }, 500);
        }
    }, [progress, onComplete]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden"
            >
                {/* Header Style PRT */}
                <div className="bg-primary px-6 py-4 flex items-center justify-between">
                    <span className="font-bold text-white tracking-widest text-lg">TPRT</span>
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></div>
                </div>

                <div className="p-8 text-center space-y-6">
                    <div className="relative h-16 w-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-gray-800">Estás en la fila virtual</h2>
                        <p className="text-gray-500 text-sm">
                            Debido a la alta demanda, hemos habilitado una fila de espera para asegurar tu reserva.
                        </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-2">
                        <p className="font-semibold text-gray-700">Tu posición actual:</p>
                        {position > 0 ? (
                            <>
                                <p className="text-4xl font-black text-primary animate-pulse">{position}</p>
                                <p className="text-xs text-gray-400">de {totalInQueue} usuarios en línea</p>
                            </>
                        ) : (
                            <p className="text-sm text-gray-400 py-2">Conectando con servidor...</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-gray-500">
                            <span>Progreso</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-3" />
                        <p className="text-[10px] text-gray-400">No cierres esta ventana. Tu turno llegará en breve.</p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
