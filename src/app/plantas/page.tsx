"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { MapPin, Search } from "lucide-react";
import Link from "next/link";

const plantas = [
    { id: 1, nombre: "GVRT San Dámaso - La Florida", direccion: "Av. La Florida 11550", comuna: "La Florida", estado: "Abierto" },
    { id: 2, nombre: "GVRT Tüv Rheinland - Huechuraba", direccion: "Santa Marta 750", comuna: "Huechuraba", estado: "Abierto" },
    { id: 3, nombre: "GVRT SGS - Quilicura", direccion: "Presidente Eduardo Frei Montalva 9800", comuna: "Quilicura", estado: "Concurrido" },
    { id: 4, nombre: "GVRT Applus - Peñalolén", direccion: "Av. Quilín 5550", comuna: "Peñalolén", estado: "Abierto" },
    { id: 5, nombre: "GVRT Inspectorate - Maipú", direccion: "Camino a Melipilla 15200", comuna: "Maipú", estado: "Cerrado" },
];

export default function PlantasPage() {
    const [filtro, setFiltro] = useState("");

    const plantasFiltradas = plantas.filter(p =>
        p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        p.comuna.toLowerCase().includes(filtro.toLowerCase())
    );

    return (
        <main className="bg-white min-h-screen pb-20 pt-8">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-8">

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold text-primary">Buscar Plantas de Revisión</h1>
                    <p className="text-gray-600">
                        Encuentre la planta más cercana a su ubicación. Puede filtrar por nombre o comuna.
                    </p>
                </div>

                {/* Buscador */}
                <div className="flex gap-4 p-6 bg-gray-50 border rounded-lg">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                placeholder="Buscar por comuna o nombre..."
                                className="pl-9 bg-white"
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                            />
                        </div>
                    </div>
                    <Button>Buscar</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Listado */}
                    <div className="md:col-span-1 space-y-4">
                        <h2 className="font-semibold text-lg text-secondary">Resultados ({plantasFiltradas.length})</h2>
                        <div className="space-y-3">
                            {plantasFiltradas.map((p) => (
                                <Card key={p.id} className="cursor-pointer hover:border-primary transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-primary text-sm">{p.nombre}</h3>
                                                <p className="text-xs text-gray-500 flex items-center mt-1">
                                                    <MapPin className="h-3 w-3 mr-1" /> {p.direccion}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">{p.comuna}</p>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold
                         ${p.estado === 'Abierto' ? 'bg-green-100 text-green-700' :
                                                    p.estado === 'Concurrido' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}
                       `}>
                                                {p.estado}
                                            </span>
                                        </div>
                                        <Button size="sm" variant="outline" className="w-full mt-3 h-8 text-xs border-secondary text-secondary hover:bg-secondary hover:text-white">
                                            <Link href={`/reservar?planta=${p.id}`}>Reservar Aquí</Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                            {plantasFiltradas.length === 0 && (
                                <div className="text-center py-8 text-gray-500 text-sm">No se encontraron plantas.</div>
                            )}
                        </div>
                    </div>

                    {/* Mapa Visual (Simulado) */}
                    <div className="md:col-span-2">
                        <Card className="h-full min-h-[500px] bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                            <div className="text-center text-gray-400">
                                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>Mapa Interactivo de Plantas</p>
                                <p className="text-xs">(Integración de Google Maps API)</p>
                            </div>
                        </Card>
                    </div>
                </div>

            </div>
        </main>
    );
}
