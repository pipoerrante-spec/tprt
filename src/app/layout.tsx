import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/site/footer";
import { SiteNav } from "@/components/site/nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GVRT Revisión Técnica",
  description:
    "Gestión de revisión técnica vehicular con retiro, traslado y entrega a domicilio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased bg-white text-black`}
      >
        <Providers>
          <div className="relative min-h-dvh flex flex-col bg-white">
            <SiteNav />
            <main className="flex-1 w-full">
              {children}
            </main>
            <SiteFooter />
          </div>
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
