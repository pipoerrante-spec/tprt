import Link from "next/link";
import { MainCarousel } from "@/components/main-carousel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, FileText, Search, BarChart3, CheckCircle } from "lucide-react";
import { getChileMonthIndex, REVISION_CALENDAR } from "@/lib/revision-calendar";
import { VehicleStatusWidget } from "@/components/vehicle/vehicle-status-widget";

export default function HomePage() {
  const currentCalendarRow = REVISION_CALENDAR[getChileMonthIndex()];
  const currentMonthLabel = currentCalendarRow.month.toUpperCase();
  const currentAutoDigit = currentCalendarRow.auto;

  return (
    <main className="bg-white min-h-screen pb-20">

      {/* 1. Calendar Strip - Racing/Digital Style */}
      <section className="bg-white border-b-4 border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-24 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">
              Calendario de Revisión Técnica
            </h2>
            <p className="text-gray-500 text-sm">Verifique su mes de revisión según su patente</p>
          </div>

          {/* Digital Month Display */}
          <div className="flex items-center gap-4 bg-black/5 p-2 rounded-lg border border-black/10">
            {/* Text Month */}
            <div className="hidden sm:block text-right">
              <span className="block text-2xl font-black text-destructive uppercase tracking-tighter">
                {currentMonthLabel}
              </span>
              <span className="block text-xs text-gray-500 font-bold uppercase">DIGITO CORRESPONDIENTE</span>
            </div>

            {/* Big Digital Number */}
            <div className="h-16 w-16 bg-black rounded-md flex items-center justify-center relative overflow-hidden shadow-inner">
              {/* "Digital" font simulation with CSS */}
              <span className="text-5xl font-mono font-bold text-red-600 tracking-tighter" style={{ textShadow: "0 0 10px rgba(220, 38, 38, 0.7)" }}>
                {currentAutoDigit}
              </span>
              {/* Scanlines overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Main Carousel */}
      <section className="border-b-4 border-primary">
        <MainCarousel />
      </section>

      <div className="bg-gray-100 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">

          {/* Pain Points Section */}
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold text-gray-800">
              ¿Cansado de perder tu día en la Revisión Técnica?
            </h2>
            <p className="text-lg text-gray-600">
              Sabemos que tu tiempo es valioso. Filas interminables, pedir permisos en el trabajo y el estrés de realizar un trámite tedioso no deberían ser parte de tu rutina.
            </p>
            <p className="text-lg font-semibold text-primary">
              Déjalo en nuestras manos. Retiramos, tramitamos y devolvemos tu auto listo.
            </p>
          </div>

          {/* 3. Banners Portal Style */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Banner 1: Statistics -> Service Pitch */}
            <div className="relative h-40 bg-gradient-to-r from-blue-900 to-blue-700 rounded-lg overflow-hidden flex items-center px-8 shadow-md border border-blue-600 group cursor-pointer hover:shadow-lg transition-all">
              <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20">
                <BarChart3 className="h-full w-full text-white" />
              </div>
              <div className="relative z-10 text-white space-y-2">
                <h3 className="text-2xl font-bold">¿Sin tiempo?</h3>
                <p className="text-blue-100 text-sm max-w-[250px]">Nosotros lo hacemos por ti. Retiro y entrega a domicilio.</p>
                <Button asChild size="sm" variant="secondary" className="mt-2 font-bold hover:bg-white hover:text-primary">
                  <Link href="/reservar">VER SERVICIO</Link>
                </Button>
              </div>
            </div>

            {/* Banner 2: My Review */}
            <div className="relative h-40 bg-white rounded-lg overflow-hidden flex items-center px-8 shadow-md border-l-8 border-l-destructive group cursor-pointer hover:shadow-lg transition-all">
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
                <CheckCircle className="h-32 w-32 text-destructive" />
              </div>
              <div className="relative z-10 text-gray-800 space-y-2">
                <h3 className="text-2xl font-bold text-primary">Estado de mi Auto</h3>
                <p className="text-gray-500 text-sm max-w-[250px]">Ingresa tu patente y revisamos si podemos ayudarte hoy.</p>
                <VehicleStatusWidget />
              </div>
            </div>
          </div>

          {/* 4. Services Grid (Legacy Cards) - Rearranged with New Copy */}
          <section>
            <h3 className="text-xl font-bold text-gray-700 mb-4 uppercase tracking-wide border-b border-gray-300 pb-2">Gestión de Trámites</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              <Link href="/reservar" className="group">
                <Card className="h-full hover:shadow-lg transition-shadow border-0 bg-white shadow-sm ring-1 ring-gray-200">
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                    <div className="h-14 w-14 bg-destructive text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                      <Calendar className="h-7 w-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Agendar Retiro</h4>
                      <p className="text-xs text-gray-500 mt-1">Vamos por tu auto hoy</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/plantas" className="group">
                <Card className="h-full hover:shadow-lg transition-shadow border-0 bg-white shadow-sm ring-1 ring-gray-200">
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                    <div className="h-14 w-14 bg-primary text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                      <MapPin className="h-7 w-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Cobertura</h4>
                      <p className="text-xs text-gray-500 mt-1">Comunas disponibles</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <div>
                <Card className="h-full border-0 bg-white shadow-sm ring-1 ring-gray-200">
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                    <div className="h-14 w-14 bg-secondary text-white rounded-full flex items-center justify-center shadow-md">
                      <FileText className="h-7 w-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Valores</h4>
                      <p className="text-xs text-gray-500 mt-1">Tarifa única todo incluido</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Link href="/ayuda" className="group">
                <Card className="h-full hover:shadow-lg transition-shadow border-0 bg-white shadow-sm ring-1 ring-gray-200">
                  <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                    <div className="h-14 w-14 bg-gray-600 text-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                      <Search className="h-7 w-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">¿Dudas?</h4>
                      <p className="text-xs text-gray-500 mt-1">Cómo funciona el servicio</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>

            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
