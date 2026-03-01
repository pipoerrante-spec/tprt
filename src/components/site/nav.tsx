"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="flex flex-col w-full z-50">
      {/* Top Section: White Background, Logos */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-16 w-44 overflow-visible sm:h-20 sm:w-52">
              <Image
                src="/pug.svg"
                alt="GVRT"
                fill
                className="origin-left object-contain object-left scale-[1.55] sm:scale-[1.75]"
                priority
              />
            </div>
          </Link>

        </div>
      </div>

      {/* Bottom Section: Blue Navigation Bar */}
      <div className="bg-secondary text-white shadow-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <nav className="flex items-center gap-6 overflow-x-auto py-3 text-sm font-medium">
            <Link href="/" className={cn("hover:text-gray-200 transition-colors whitespace-nowrap", pathname === "/" && "underline underline-offset-4")}>
              Inicio
            </Link>
            <Link href="/calendario" className="hover:text-gray-200 transition-colors whitespace-nowrap">
              Calendario
            </Link>
            <Link href="/plantas" className="hover:text-gray-200 transition-colors whitespace-nowrap">
              Plantas
            </Link>
            <Link href="/reservar" className="hover:text-gray-200 transition-colors whitespace-nowrap">
              Reservar hora
            </Link>
            <Link href="/ayuda" className="hover:text-gray-200 transition-colors whitespace-nowrap">
              Ayuda
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
