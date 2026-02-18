import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="w-full bg-muted border-t border-gray-200 mt-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">

          <div className="space-y-3">
            <h3 className="font-bold text-primary">Sobre nosotros</h3>
            <ul className="space-y-2 text-gray-600">
              <li><Link href="#" className="hover:underline">Quiénes somos</Link></li>
              <li><Link href="#" className="hover:underline">Misión y Visión</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-primary">Información</h3>
            <ul className="space-y-2 text-gray-600">
              <li><Link href="/calendario" className="hover:underline">Calendario</Link></li>
              <li><Link href="/plantas" className="hover:underline">Plantas TPRT</Link></li>
              <li><Link href="#" className="hover:underline">Tarifas</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-primary">Contacto</h3>
            <ul className="space-y-2 text-gray-600">
              <li>Mesa de Ayuda</li>
              <li>contacto@tprt.cl</li>
            </ul>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 bg-gray-300 rounded-full flex items-center justify-center text-xs text-center">
                Logo Gob
              </div>
              <span className="text-xs text-gray-500 max-w-[120px]">
                Ministerio de Transportes y Telecomunicaciones
              </span>
            </div>
          </div>

        </div>

        <Separator className="my-6 bg-gray-300" />

        <div className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} TPRT. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}

