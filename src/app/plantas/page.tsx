"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, Clock3, MapPin, Search } from "lucide-react";

const plantas = [
    { id: 6, nombre: "UVT La Reina", direccion: "Alcalde Fernando Castillo Velasco 8602", comuna: "La Reina", estado: "Abierto" },
    { id: 7, nombre: "Dekra La Reina", direccion: "Aguas Claras 1700", comuna: "La Reina", estado: "Concurrido" },
    { id: 1, nombre: "San Dámaso - La Florida", direccion: "Av. La Florida 11550", comuna: "La Florida", estado: "Abierto" },
    { id: 9, nombre: "Dekra Independencia", direccion: "Av. Independencia 5595", comuna: "Independencia", estado: "Abierto" },
    { id: 8, nombre: "UVT La Florida", direccion: "Av. Vicuña Mackenna 10395", comuna: "La Florida", estado: "Abierto" },
    { id: 2, nombre: "Tüv Rheinland - Huechuraba", direccion: "Santa Marta 750", comuna: "Huechuraba", estado: "Abierto" },
    { id: 3, nombre: "SGS - Quilicura", direccion: "Presidente Eduardo Frei Montalva 9800", comuna: "Quilicura", estado: "Concurrido" },
    { id: 4, nombre: "Applus - Peñalolén", direccion: "Av. Quilín 5550", comuna: "Peñalolén", estado: "Abierto" },
    { id: 5, nombre: "Inspectorate - Maipú", direccion: "Camino a Melipilla 15200", comuna: "Maipú", estado: "Cerrado" },
];

export default function PlantasPage() {
    const [filtro, setFiltro] = useState("");

    const plantasFiltradas = useMemo(
        () =>
            plantas.filter(
                (p) =>
                    p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
                    p.comuna.toLowerCase().includes(filtro.toLowerCase()),
            ),
        [filtro],
    );

    const abiertas = plantasFiltradas.filter((p) => p.estado === "Abierto").length;
    const concurridas = plantasFiltradas.filter((p) => p.estado === "Concurrido").length;
    const cerradas = plantasFiltradas.filter((p) => p.estado === "Cerrado").length;

    return (
        <main className="min-h-screen bg-[linear-gradient(180deg,#f7f9fd_0%,#eef4ff_48%,#ffffff_100%)] pb-20 pt-8">
            <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
                <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
                    <div className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_60px_-30px_rgba(23,57,122,0.35)] backdrop-blur">
                        <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-primary/80">
                            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Plantas</span>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{abiertas} abiertas hoy</span>
                        </div>
                        <div className="mt-6 max-w-3xl space-y-4">
                            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                                Encuentra la planta adecuada y reserva sin perder tiempo.
                            </h1>
                            <p className="text-base leading-7 text-slate-600 sm:text-lg">
                                Filtra por comuna o nombre y revisa el estado operativo de cada planta en una vista más útil y directa.
                            </p>
                        </div>
                    </div>

                    <Card className="border-0 bg-[linear-gradient(160deg,#0a4ecb_0%,#08358d_100%)] text-white shadow-[0_24px_60px_-30px_rgba(8,53,141,0.75)]">
                        <CardHeader className="space-y-3">
                            <CardTitle className="text-xl font-black tracking-tight text-white">Resumen operativo</CardTitle>
                            <p className="text-sm leading-6 text-blue-100">
                                Esta vista prioriza búsqueda, disponibilidad y acción inmediata. Sin bloques vacíos ni referencias técnicas irrelevantes.
                            </p>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm">
                            <div className="rounded-2xl bg-white/10 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.22em] text-blue-100">Resultados</div>
                                <div className="mt-1 text-3xl font-black">{plantasFiltradas.length}</div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-2xl bg-white/10 px-3 py-4 text-center">
                                    <div className="text-2xl font-black">{abiertas}</div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-blue-100">Abiertas</div>
                                </div>
                                <div className="rounded-2xl bg-white/10 px-3 py-4 text-center">
                                    <div className="text-2xl font-black">{concurridas}</div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-blue-100">Concurridas</div>
                                </div>
                                <div className="rounded-2xl bg-white/10 px-3 py-4 text-center">
                                    <div className="text-2xl font-black">{cerradas}</div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-blue-100">Cerradas</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.28)] backdrop-blur sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                            <h2 className="text-lg font-bold text-slate-900">Busca por comuna o nombre</h2>
                            <p className="text-sm text-slate-500">La lista ocupa todo el ancho útil para que la decisión sea rápida.</p>
                        </div>
                        <div className="relative w-full max-w-xl">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Ej: La Florida, Quilicura, Dekra..."
                                className="h-12 rounded-full border-slate-200 bg-slate-50 pl-11 pr-4"
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                            />
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-slate-900">Plantas disponibles</h2>
                            <p className="text-sm text-slate-500">Selecciona una planta y sigue directo a la reserva.</p>
                        </div>
                        <p className="text-sm font-medium text-slate-500">Mostrando {plantasFiltradas.length} resultados</p>
                    </div>

                    {plantasFiltradas.length === 0 ? (
                        <Card className="border-dashed border-slate-300 bg-white/80">
                            <CardContent className="py-12 text-center text-sm text-slate-500">
                                No se encontraron plantas con ese filtro.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {plantasFiltradas.map((p) => (
                                <Card
                                    key={p.id}
                                    className="group overflow-hidden border-slate-200/80 bg-white/95 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_22px_44px_-28px_rgba(10,78,203,0.45)]"
                                >
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                        <Building2 className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-black tracking-tight text-slate-900">{p.nombre}</h3>
                                                        <p className="text-sm font-medium text-slate-500">{p.comuna}</p>
                                                    </div>
                                                </div>

                                                <div className="grid gap-2 text-sm text-slate-600">
                                                    <div className="flex items-start gap-2">
                                                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                                        <span>{p.direccion}</span>
                                                    </div>
                                                    <div className="flex items-start gap-2">
                                                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                                        <span>Estado actual de operación: {p.estado}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <span
                                                className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
                                                    p.estado === "Abierto"
                                                        ? "bg-emerald-50 text-emerald-700"
                                                        : p.estado === "Concurrido"
                                                            ? "bg-amber-50 text-amber-700"
                                                            : "bg-rose-50 text-rose-700"
                                                }`}
                                            >
                                                {p.estado}
                                            </span>
                                        </div>

                                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <Button asChild className="h-11 flex-1">
                                                <Link href={`/reservar?planta=${p.id}`}>Reservar aquí</Link>
                                            </Button>
                                            <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                {p.comuna}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
