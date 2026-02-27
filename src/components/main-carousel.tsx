"use client"

import * as React from "react"
import useEmblaCarousel from "embla-carousel-react"
import Autoplay from "embla-carousel-autoplay"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export function MainCarousel() {
    const [emblaRef] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000 })])

    return (
        <div className="relative w-full h-[300px] md:h-[400px] overflow-hidden bg-gray-900" ref={emblaRef}>
            <div className="flex h-full">

                {/* Slide 1: Service Value Prop */}
                <div className="relative flex-[0_0_100%] h-full min-w-0">
                    <div
                        className="absolute inset-0 bg-cover bg-center opacity-80"
                        style={{ backgroundImage: "url('/images/carousel-lights.png')" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent flex items-center">
                        <div className="mx-auto max-w-7xl px-6 w-full">
                            <div className="max-w-xl space-y-4 animate-in fade-in slide-in-from-left duration-700">
                                <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-md leading-tight">
                                    No pierdas tu mañana <br /><span className="text-blue-400">en la fila</span>
                                </h2>
                                <p className="text-lg text-gray-200 drop-shadow-sm max-w-md">
                                    Nuestro servicio incluye <strong>retiro, trámite y devolución</strong>. Recupera tu tiempo mientras nosotros nos encargamos de todo.
                                </p>
                                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white border-0 font-bold text-lg mt-4 h-12 px-8 shadow-lg shadow-blue-900/20">
                                    <Link href="/reservar">AGENDAR RETIRO</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Slide 2: Coverage/Safety */}
                <div className="relative flex-[0_0_100%] h-full min-w-0">
                    <video
                        className="absolute inset-0 h-full w-full object-cover opacity-80"
                        src="/prt.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent flex items-center">
                        <div className="mx-auto max-w-7xl px-6 w-full">
                            <div className="max-w-xl space-y-4">
                                <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-md">
                                    Revisión Técnica <br /><span className="text-green-400">a Domicilio</span>
                                </h2>
                                <p className="text-lg text-gray-200 drop-shadow-sm">
                                    Cobertura en todo Santiago. Choferes certificados y seguro incluido por 3.000 UF. 100% Seguro y Transparente.
                                </p>
                                <Button asChild size="lg" className="bg-destructive hover:bg-destructive/90 text-white border-0 font-bold text-lg mt-4 h-12 px-8">
                                    <Link href="/reservar">RESERVAR AHORA</Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
