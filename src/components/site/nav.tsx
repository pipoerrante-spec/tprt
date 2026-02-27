"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Ticket } from "lucide-react";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="flex flex-col w-full z-50">
      {/* Top Section: White Background, Logos */}
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            {/* PRT-style Logo Wrapper */}
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-destructive/10 border border-destructive">
              <Ticket className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold text-primary italic tracking-tight leading-none">
                GVRT
              </span>
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest leading-none">
                REVISIÓN TÉCNICA
              </span>
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
