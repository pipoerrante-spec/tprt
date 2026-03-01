import Image from "next/image";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="w-full bg-muted border-t border-gray-200 mt-auto">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-sm">
          <div className="space-y-3">
            <Image src="/pug.svg" alt="GVRT" width={180} height={56} className="h-14 w-auto" />
            <ul className="space-y-2 text-gray-600">
              <li>Gestión integral de revisión técnica vehicular.</li>
              <li>Retiro, traslado y entrega en domicilio.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-primary">Información</h3>
            <ul className="space-y-2 text-gray-600">
              <li><Link href="/calendario" className="hover:underline">Calendario</Link></li>
              <li><Link href="/plantas" className="hover:underline">Plantas</Link></li>
              <li><Link href="/terminos" className="hover:underline">Términos y Condiciones</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-primary">Contacto</h3>
            <ul className="space-y-2 text-gray-600">
              <li>Correo: contacto@gvrt.cl</li>
              <li>Sitio web: www.gvrt.cl</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-primary">Importante</h3>
            <p className="text-gray-600">
              Al contratar el servicio aceptas los Términos y Condiciones de GVRT Revisión Técnica.
            </p>
          </div>
        </div>

        <Separator className="my-6 bg-gray-300" />

        <div className="text-center text-xs text-gray-500">
          © {new Date().getFullYear()} GVRT Revisión Técnica. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
